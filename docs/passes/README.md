# Wallet pass gameplan (Apple & Google)

You can self-host passes; you just need one-time certificates/keys to sign them. Outline below uses your existing card URLs and contact data.

## Apple Wallet (.pkpass)
1) Enroll in the Apple Developer Program (required to create Pass Type IDs and certificates).  
2) In Apple Developer portal, create a Pass Type ID (e.g., `pass.com.salonglamournc.cards`).  
3) Generate and download the Pass Type ID certificate (`.p12`) and note its password.  
4) Build a pass bundle (JSON + assets + manifest):  
   - `pass.json` (sample fields)  
     ```json
     {
       "formatVersion": 1,
       "passTypeIdentifier": "pass.com.salonglamournc.cards",
       "teamIdentifier": "YOUR_TEAM_ID",
       "organizationName": "Salon Glamour NC",
       "description": "Digital card for Linda Fuentes",
       "serialNumber": "linda-001",
       "foregroundColor": "rgb(90,58,51)",
       "backgroundColor": "rgb(235,200,181)",
       "logoText": "Prima Beauty",
       "generic": {
         "primaryFields": [{ "key": "name", "label": "Cosmetologist Tech", "value": "Linda Fuentes" }],
         "secondaryFields": [
           { "key": "phone", "label": "Phone", "value": "(336) 521-9528" },
           { "key": "email", "label": "Email", "value": "primabeauty26@gmail.com" }
         ],
         "auxiliaryFields": [
           { "key": "insta", "label": "Instagram", "value": "@prima.beauty26" },
           { "key": "booking", "label": "Booking", "value": "Square Appointments" }
         ],
         "backFields": [
           { "key": "url", "label": "View card", "value": "https://salonglamournc.com/linda" }
         ]
       },
       "barcodes": [{
         "format": "PKBarcodeFormatQR",
         "message": "https://salonglamournc.com/linda",
         "messageEncoding": "iso-8859-1"
       }]
     }
     ```
   - Assets: `icon.png`/`icon@2x.png`, `logo.png`, `background.png` (use Linda.jpg cropped), plus any strip images.  
5) Create a manifest (SHA1 of each file) and sign it with your Pass certificate using `signpass` or `openssl` (Apple docs have commands).  
6) Zip the bundle with the signature as `pass.pkpass` and host it (e.g., `https://salonglamournc.com/passes/linda.pkpass`).  
7) Link “Add to Apple Wallet” to that URL with correct MIME type `application/vnd.apple.pkpass`.

## Google Wallet pass
1) In Google Cloud, enable Google Wallet API and create a service account with a Wallet Role; download the JSON key.  
2) Create a class/object for a “Generic pass” via REST or the Google Wallet codelab: include name/title, phone, email, Instagram, booking URL, and QR to `https://salonglamournc.com/linda`.  
3) Generate a “Save to Google Wallet” link or button using the signed JWT from the service account.  
4) Host the button/link on `https://salonglamournc.com/linda` once the Wallet object/class is live.

## Files to keep together (recommended)
- `/docs/passes/linda/` containing `pass.json`, images, manifest, and the signed `linda.pkpass`.  
- A short script `sign_pass.sh` that hashes, signs, and zips (once your Pass cert `.p12` is on disk).  
- A JWT generator script for Google Wallet using your service account JSON.

If you share your Apple Pass Type ID, Team ID, and provide the cert `.p12` + password (privately), I can wire up the scripts and deliver signed `.pkpass` plus a Google “Save to Wallet” button. Until then, the page already supports native sharing via the “Share Card” button and the downloadable vCard.
