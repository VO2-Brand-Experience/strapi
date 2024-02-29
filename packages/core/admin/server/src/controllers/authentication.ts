import type { Context, Next } from 'koa';
import _ from 'lodash';
import { randomInt } from 'crypto';
import passport from 'koa-passport';
import compose from 'koa-compose';
import '@strapi/types';
import { errors } from '@strapi/utils';
import { getService } from '../utils';
import {
  validateRegistrationInput,
  validateAdminRegistrationInput,
  validateRegistrationInfoQuery,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateRenewTokenInput,
} from '../validation/authentication';

import type {
  ForgotPassword,
  Login,
  Register,
  RegistrationInfo,
  RenewToken,
  ResetPassword,
} from '../../../shared/contracts/authentication';
import { AdminUser } from '../../../shared/contracts/shared';

const { ApplicationError, ValidationError } = errors;

export default {
  login: compose([
    (ctx: Context, next: Next) => {
      return passport.authenticate('local', { session: false }, (err, user, info) => {
        if (!ctx.session) {
          throw new Error('Session is not available');
        }

        if (err) {
          strapi.eventHub.emit('admin.auth.error', { error: err, provider: 'local' });
          // if this is a recognized error, allow it to bubble up to user
          if (err.details?.code === 'LOGIN_NOT_ALLOWED') {
            throw err;
          }

          // for all other errors throw a generic error to prevent leaking info
          return ctx.notImplemented();
        }

        if (!user) {
          strapi.eventHub.emit('admin.auth.error', {
            error: new Error(info.message),
            provider: 'local',
          });
          throw new ApplicationError(info.message);
        }

        const token = randomInt(100000, 999999).toString();
        strapi
          .plugin('email')
          .service('email')
          .sendTemplatedEmail(
            {
              to: user.email,
              from: strapi.config.get('admin.otp.from'),
              replyTo: strapi.config.get('admin.otp.replyTo'),
            },
            strapi.config.get('admin.otp.emailTemplate'),
            {
              token,
              user: _.pick(user, ['email', 'firstname', 'lastname', 'username']),
            }
          )
          .catch((err: unknown) => {
            // log error server side but do not disclose it to the user to avoid leaking informations
            strapi.log.error(err);
          });
        if (process.env.NODE_ENV === 'development') {
          console.log('otp', token);
        }
        ctx.session.token = token;
        ctx.session.tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
        ctx.session.user = user;

        const query = ctx.state as Login.Request['query'];
        query.user = user;

        const sanitizedUser = getService('user').sanitizeUser(user);
        strapi.eventHub.emit('admin.auth.success', { user: sanitizedUser, provider: 'local' });

        return next();
      })(ctx, next);
    },
    (ctx: Context) => {
      // const { user } = ctx.state as { user: AdminUser };

      ctx.body = {
        data: {
          token: '', // getService('token').createJwtToken(user),
          user: getService('user').sanitizeUser(ctx.state.user), // TODO: fetch more detailed info
        },
      } satisfies Login.Response;
    },
  ]),

  async otp(ctx: Context) {
    if (!ctx.session) {
      throw new Error('Session is not available');
    }

    const input = JSON.parse(ctx.request.body);

    if (input.token !== ctx.session.token || new Date() > new Date(ctx.session.tokenExpiry)) {
      throw new Error('Verification code is incorrect or expired');
    } else {
      ctx.body = {
        data: {
          token: getService('token').createJwtToken(ctx.session.user),
          // user: getService('user').sanitizeUser(ctx.session.user), // TODO: fetch more detailed info
        },
      } satisfies Login.ResponseOtp;
    }
  },

  async renewToken(ctx: Context) {
    await validateRenewTokenInput(ctx.request.body);

    const { token } = ctx.request.body as RenewToken.Request['body'];

    const { isValid, payload } = getService('token').decodeJwtToken(token);

    if (!isValid) {
      throw new ValidationError('Invalid token');
    }

    ctx.body = {
      data: {
        token: getService('token').createJwtToken({ id: payload.id }),
      },
    } satisfies RenewToken.Response;
  },

  async registrationInfo(ctx: Context) {
    await validateRegistrationInfoQuery(ctx.request.query);

    const { registrationToken } = ctx.request.query as RegistrationInfo.Request['query'];

    const registrationInfo = await getService('user').findRegistrationInfo(registrationToken);

    if (!registrationInfo) {
      throw new ValidationError('Invalid registrationToken');
    }

    ctx.body = { data: registrationInfo } satisfies RegistrationInfo.Response;
  },

  async register(ctx: Context) {
    const input = ctx.request.body as Register.Request['body'];

    await validateRegistrationInput(input);

    const user = await getService('user').register(input);

    ctx.body = {
      data: {
        token: getService('token').createJwtToken(user),
        user: getService('user').sanitizeUser(user),
      },
    } satisfies Register.Response;
  },

  async registerAdmin(ctx: Context) {
    const input = ctx.request.body as Register.Request['body'];

    await validateAdminRegistrationInput(input);

    const hasAdmin = await getService('user').exists();

    if (hasAdmin) {
      throw new ApplicationError('You cannot register a new super admin');
    }

    const superAdminRole = await getService('role').getSuperAdmin();

    if (!superAdminRole) {
      throw new ApplicationError(
        "Cannot register the first admin because the super admin role doesn't exist."
      );
    }

    const user = await getService('user').create({
      ...input,
      registrationToken: null,
      isActive: true,
      roles: superAdminRole ? [superAdminRole.id] : [],
    });

    strapi.telemetry.send('didCreateFirstAdmin');

    ctx.body = {
      data: {
        token: getService('token').createJwtToken(user),
        user: getService('user').sanitizeUser(user),
      },
    };
  },

  async forgotPassword(ctx: Context) {
    const input = ctx.request.body as ForgotPassword.Request['body'];

    await validateForgotPasswordInput(input);

    getService('auth').forgotPassword(input);

    ctx.status = 204;
  },

  async resetPassword(ctx: Context) {
    const input = ctx.request.body as ResetPassword.Request['body'];

    await validateResetPasswordInput(input);

    const user = await getService('auth').resetPassword(input);

    ctx.body = {
      data: {
        token: getService('token').createJwtToken(user),
        user: getService('user').sanitizeUser(user),
      },
    } satisfies ResetPassword.Response;
  },

  logout(ctx: Context) {
    const sanitizedUser = getService('user').sanitizeUser(ctx.state.user);
    strapi.eventHub.emit('admin.logout', { user: sanitizedUser });
    ctx.body = { data: {} };
  },
};
