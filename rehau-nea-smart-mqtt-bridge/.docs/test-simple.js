const https = require('https');

const url = 'https://accounts.rehau.com/authz-srv/authz?client_id=3f5d915d-a06f-42b9-89cc-2e5d63aa96f1&scope=email+roles+profile+offline_access+groups&response_type=code&redirect_uri=https://rehau-smartheating-email-gallery-public.s3.eu-central-1.amazonaws.com/publicimages/preprod/rehau.jpg&nonce=test123&code_challenge_method=S256&code_challenge=test456';

console.log('Testing URL:', url);
console.log('');

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 403) {
      console.log('\n❌ Got 403 - Cloudflare blocking');
      console.log('Response preview:', data.substring(0, 200));
    } else {
      console.log('\n✅ Success!');
      console.log('Response preview:', data.substring(0, 200));
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
