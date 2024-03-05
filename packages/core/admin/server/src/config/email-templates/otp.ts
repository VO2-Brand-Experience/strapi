const subject = `Authentification CMS Nirio`;

const html = `<p>Bonjour,</p>
<br />
<p>Votre code de vérification pour la connexion à Nirio est : <%= token %></p>
<br />
<p>
Veuillez utiliser ce code pour vous connecter. Attention, ne partagez ce code à personne.
</p>
<br />
<p>Merci.</p>
<p>L'équipe Nirio</p>`;

const text = `Bonjour,

Votre code de vérification pour la connexion à Nirio est : <%= token %>

Veuillez utiliser ce code pour vous connecter. Attention, ne partagez ce code à personne.

Merci,
L'équipe Nirio`;

export default { subject, text, html };
