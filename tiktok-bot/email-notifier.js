require('dotenv').config({ path: __dirname + '/.env' });
const nodemailer = require('nodemailer');

// =============================================
// Envoi de l'email de notification
// =============================================
async function sendNotificationEmail({ recipeName, postId, adminUrl, publicUrl, ingredients, steps, tiktokUrl, photoUrl }) {

    // Si pas d'App Password Gmail → on log juste sans envoyer
    if (!process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD === 'METS_TON_APP_PASSWORD_ICI') {
        console.log('   ⚠️  Email non configuré (GMAIL_APP_PASSWORD manquant)');
        console.log(`   📧 → Brouillon à review : ${adminUrl}`);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    const ingredientsHtml = ingredients.slice(0, 5)
        .map(ing => `<li>${ing}</li>`).join('') +
        (ingredients.length > 5 ? `<li><em>...et ${ingredients.length - 5} autres</em></li>` : '');

    const stepsHtml = steps.slice(0, 3)
        .map((step, i) => `<li>${step}</li>`).join('') +
        (steps.length > 3 ? `<li><em>...et ${steps.length - 3} autres étapes</em></li>` : '');

    const photoSection = photoUrl
        ? `<img src="${photoUrl}" alt="${recipeName}" style="max-width:100%;border-radius:8px;margin:16px 0;">`
        : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
  .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  h1 { color: #e44d26; font-size: 24px; margin: 0 0 8px; }
  .badge { display:inline-block; background:#e44d26; color:white; padding:4px 12px; border-radius:20px; font-size:12px; margin-bottom:16px; }
  .btn { display:inline-block; background:#e44d26; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; margin:8px 4px; }
  .btn.secondary { background:#333; }
  h3 { color: #333; margin: 20px 0 8px; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; }
  ul, ol { margin: 0; padding-left: 20px; }
  li { margin: 4px 0; color: #555; }
  .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <span class="badge">🎵 TikTok → WordPress</span>
  <h1>🍽️ Nouvelle recette détectée !</h1>
  <p style="color:#666;margin-bottom:16px;">Un brouillon a été créé automatiquement depuis un favori TikTok.</p>

  ${photoSection}

  <h2 style="margin:0 0 16px;">${recipeName}</h2>

  <a href="${adminUrl}" class="btn">✏️ Éditer le brouillon</a>
  <a href="${tiktokUrl}" class="btn secondary">🎵 Voir TikTok</a>

  <h3>📦 Ingrédients (${ingredients.length})</h3>
  <ul>${ingredientsHtml}</ul>

  <h3>👨‍🍳 Étapes (${steps.length})</h3>
  <ol>${stepsHtml}</ol>

  <div class="footer">
    <p>Généré automatiquement par le bot TikTok→WordPress<br>
    ID du post WordPress : #${postId}</p>
  </div>
</div>
</body>
</html>`;

    try {
        const info = await transporter.sendMail({
            from: `"🍽️ Recettes Magiques Bot" <${process.env.GMAIL_USER}>`,
            to: process.env.GMAIL_TO,
            subject: `🍽️ Nouvelle recette : ${recipeName} [Brouillon WP #${postId}]`,
            html: html
        });

        console.log(`   ✅ Email envoyé à ${process.env.GMAIL_TO}`);
        console.log(`   📧 Message ID: ${info.messageId}`);
    } catch (err) {
        console.error('   ❌ Erreur email:', err.message);
        console.log(`   📝 Brouillon disponible ici : ${adminUrl}`);
    }
}

module.exports = { sendNotificationEmail };
