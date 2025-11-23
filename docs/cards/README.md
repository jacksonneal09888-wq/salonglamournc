# Adding a new digital business card

This site is static. To add another stylist/tech card, follow these steps using Cecilia/Linda as examples.

1) Assets  
   - Drop the portrait/photo into `docs/assets/images/` (e.g., `firstname.jpg`).  
   - If you want a QR, generate it for the page URL you’ll publish (e.g., `https://salonglamournc.com/firstname`) and save it next to the photo.

2) Contact card (vCard)  
   - Copy an existing file in `docs/cards/` and rename (e.g., `firstname.vcf`).  
   - Update `N`, `FN`, `TITLE`, phone, email, and any URLs (Instagram, booking, website).

3) Page  
   - Copy a card folder (e.g., `docs/linda`) to `docs/{name}` and update the HTML: photo path, name/title text, phone/email, booking, Instagram, QR path, and the vCard link.  
   - Keep image paths like `/assets/images/yourfile.jpg` so they resolve in production.

4) Publish  
   - Commit/push changes.  
   - Point `https://salonglamournc.com/{name}` at `docs/{name}/index.html` (match the folder name).  
   - Test the QR and “Save Contact” link on mobile.

Notes  
- Use the palette and layout from existing cards for consistency, or adjust colors inside that card’s CSS.  
- Square booking URL template (replace if needed):  
  `https://book.squareup.com/appointments/xzwxbrdzvqp39y/location/RP38RJ3DZ5D4R/services`
