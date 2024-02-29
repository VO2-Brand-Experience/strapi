const subject = `Authentification double facteur`;

const html = `<p>Vous êtes en train de vous connecter.</p>

<p>Veuillez retrouver le token de connexion ci-dessous</p>

<p><%= token %></p>

<p>Merci.</p>`;

const text = `Vous êtes en train de vous connecter.

Veuillez retrouver le token de connexion ci-dessous

<%= token %>

Merci.`;

export default { subject, text, html };
