# Eigen plaatjes (optioneel)

De app heeft voor elke oefening al een ingebouwde illustratie. Wil je er toch een eigen foto of
tekening voor gebruiken:

1. Zet het bestand in deze map, bijvoorbeeld `images/hip-thrust.jpg` (jpg, png, webp of svg).
2. Registreer het in `data.js` bij `LOCAL_IMAGES`, met het id van de oefening:

   ```js
   const LOCAL_IMAGES = {
     'bf-hip-thrust': 'images/hip-thrust.jpg',
   };
   ```

3. Verhoog `CACHE` in `sw.js` zodat de telefoon de nieuwe versie ophaalt.

Kan het bestand niet geladen worden, dan blijft automatisch de ingebouwde illustratie zichtbaar.
Oefening-id's staan in `data.js` (`pb-…` = pilatesbord, `bf-…` = Basic-Fit).
