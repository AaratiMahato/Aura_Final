// Creates server/.env with a random secret the first time you run the project
const fs = require('fs');
const crypto = require('crypto');
const target = 'server/.env';
if (!fs.existsSync(target)) {
  const env = fs
    .readFileSync('server/.env.example', 'utf8')
    .replace('JWT_SECRET=change-me', 'JWT_SECRET=' + crypto.randomBytes(32).toString('hex'));
  fs.writeFileSync(target, env);
  console.log('\nCreated server\\.env  ->  open it and add MONGODB_URI and GEMINI_API_KEY, then run start.bat again.\n');
  process.exit(2);
}
