const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;
const JWT_SECRET = "supersecretkey"; // ⚠️ à mettre dans un .env si tu déploies

app.use(cors());
app.use(bodyParser.json());

// 🔐 Utilisateurs stockés temporairement en mémoire
const users = [
  {
    id: 1,
    email: "admin@scpf.com",
    passwordHash: bcrypt.hashSync("admin123", 10),
  },
];

// 🔐 Tokens de réinitialisation en mémoire
const resetTokens = {};

// 📬 Transporteur nodemailer avec Sendinblue (Brevo)
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "933c3c001@smtp-brevo.com", // ← identifiant SMTP (pas ton Gmail)
    pass: "AyVjRCbXhpBw2aIg"
  }
});

// ▶ Connexion
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ message: "Utilisateur non trouvé" });

  const isValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isValid) return res.status(401).json({ message: "Mot de passe incorrect" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ message: "Connexion réussie", token });
});

// ▶ Inscription
app.post("/api/register", (req, res) => {
  const { email, password } = req.body;
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) return res.status(409).json({ message: "Utilisateur déjà inscrit" });

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = {
    id: users.length + 1,
    email,
    passwordHash,
  };
  users.push(newUser);
  res.status(201).json({ message: "Inscription réussie" });
});

// ▶ Liste des utilisateurs (debug uniquement)
app.get("/api/users", (req, res) => {
  const userList = users.map((u) => ({ id: u.id, email: u.email }));
  res.json(userList);
});

// ▶ Envoi du lien de réinitialisation par mail
app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(404).json({ message: "Aucun utilisateur trouvé avec cet email." });

  const token = Math.random().toString(36).substring(2, 10);
  resetTokens[token] = email;

  const resetLink = `http://localhost:5500/frontend/reset.html?token=${token}`;

  const mailOptions = {
    from: '"SCPF Support" <sbaiouassim@gmail.com>', // ← expéditeur vérifié Sendinblue
    to: email,
    subject: "Réinitialisation de votre mot de passe",
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
      <p>Cliquez sur le lien suivant pour le réinitialiser :</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Ce lien expirera dans quelques minutes.</p>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Erreur d'envoi :", error);
      return res.status(500).json({ message: "Erreur d'envoi de l'e-mail." });
    } else {
      console.log("✉️ E-mail envoyé :", info.response);
      res.json({ message: "E-mail de réinitialisation envoyé avec succès." });
    }
  });
});

// ▶ Réinitialisation du mot de passe
app.post("/api/reset-password", (req, res) => {
  const { token, password } = req.body;

  const email = resetTokens[token];
  if (!email) return res.status(400).json({ message: "Lien invalide ou expiré." });

  const user = users.find((u) => u.email === email);
  if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });

  user.passwordHash = bcrypt.hashSync(password, 10);
  delete resetTokens[token];

  res.json({ message: "Mot de passe mis à jour avec succès." });
});

// ▶ Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
