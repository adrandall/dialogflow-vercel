import { sendIdleMessages } from "./webhook.js"; // adjust path if needed

export default async function handler(req, res) {
  await sendIdleMessages();
  res.status(200).send("Idle messages sent");
}
