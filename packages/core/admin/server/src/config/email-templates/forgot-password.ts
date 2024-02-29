const subject = `Réinitialisation de mot de passe`;

const html = `<p>Vous avez oublié votre mot de passe. Aucun problème !</p>

<p>Veuillez retrouver un lien pour le rénitialiser ci-dessous :</p>

<p><%= url %></p>

<p>Merci.</p>`;

const text = `Vous avez oublié votre mot de passe. Aucun problème !

Veuillez retrouver un lien pour le rénitialiser ci-dessous :

<%= url %>

Merci.`;

export default { subject, text, html };
