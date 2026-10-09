# Conti Chiari — come installarla su Android e iPhone

Conti Chiari divide le spese di gruppo e calcola chi deve quanto a chi, con il minor numero di trasferimenti.
Funziona senza internet. I dati restano sul telefono. Per passare un gruppo a un amico si usa il **codice del gruppo**.

Ci sono due strade. La prima basta per quasi tutti.

---

## Strada 1 — App web installabile (Android e iPhone, gratis, 10 minuti)

Serve solo un account GitHub gratuito.

1. Vai su https://github.com e crea un account, se non lo hai.
2. Crea un nuovo repository: pulsante **New**, nome `conti-chiari`, visibilità **Public**, poi **Create repository**.
3. Nella pagina del repository tocca **uploading an existing file**. Trascina **tutto il contenuto** di questa cartella (anche la cartella `.github`, che può essere nascosta: su Mac premi Cmd+Shift+. per vederla). Poi **Commit changes**.
4. Vai su **Settings → Pages**. Alla voce **Source** scegli **GitHub Actions**.
5. Vai su **Actions** e attendi che "App web (iPhone e Android)" diventi verde (circa 1 minuto). L'indirizzo dell'app sarà:
   `https://TUO-NOME-UTENTE.github.io/conti-chiari/`

**Installarla su iPhone:** apri l'indirizzo con **Safari** → tasto Condividi → **Aggiungi alla schermata Home**.

**Installarla su Android:** apri l'indirizzo con **Chrome** → menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").

L'icona compare tra le app, si apre a schermo intero e funziona anche offline.
Puoi mandare lo stesso indirizzo agli amici: ognuno installa l'app sul proprio telefono.

> Alternativa senza GitHub: su https://app.netlify.com/drop trascina la cartella `www`. Ottieni subito un indirizzo da aprire sul telefono.

---

## Strada 2 — File APK per Android

Usa lo stesso repository della Strada 1. Ad ogni caricamento GitHub costruisce l'APK da solo.

1. Vai su **Actions → App Android (APK)** e aspetta che l'esecuzione più recente diventi verde. La prima volta impiega circa 5 minuti.
2. Dal telefono, apri `https://github.com/TUO-NOME-UTENTE/conti-chiari/releases/download/android-latest/ContiChiari.apk`. È sempre l'ultima versione e lo stesso link è nell'app web, in **Impostazioni → Guida e video**. In alternativa, nell'esecuzione su **Actions** scarica lo zip **ContiChiari-android** sotto **Artifacts**.
3. Se Chrome avvisa che il file può essere dannoso, tocca **Scarica comunque**. Apri il file e consenti a Chrome di **installare app sconosciute** quando Android lo chiede.
4. Se **Play Protect** avvisa, tocca **Altri dettagli → Installa comunque**.

**Firma stabile (consigliata, una volta sola).** Android installa un aggiornamento sopra la versione vecchia solo se le due versioni sono firmate con la stessa chiave. Senza questo passaggio GitHub crea una chiave nuova a ogni versione. Allora l'aggiornamento dà «App non installata» e bisogna disinstallare l'app, perdendo i dati.
1. Crea una chiave sul computer: `keytool -genkeypair -keystore contichiari.keystore -storetype PKCS12 -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Conti Chiari"`. Poi convertila in testo: `base64 -w0 contichiari.keystore` (su Mac `base64 -i contichiari.keystore`).
2. Su GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Come nome scrivi `ANDROID_DEBUG_KEYSTORE`, come valore incolla il testo, poi **Add secret**.
3. Da quel momento ogni APK ha la stessa firma. Conserva il file `contichiari.keystore`: se lo perdi, il prossimo aggiornamento richiederà di disinstallare l'app.

**Se l'app non si installa o si interrompe all'avvio** («Conti Chiari si è interrotta», spesso insieme a «Google Play Store» o «Servizi Google Play»), il problema di solito è del Play Store sul telefono, non dell'app:
1. **Impostazioni → Applicazioni → Google Play Store → Archivio → Svuota cache**. Se serve, fai lo stesso per **Servizi Google Play** (solo «Svuota cache», non «Cancella dati»).
2. Riavvia il telefono, reinstalla l'APK e riaprilo.
3. Se si interrompe ancora, aggiorna dal Play Store **Google Chrome** e **Android System WebView** (su Android 7 l'app usa Chrome per mostrare le pagine).

Questo APK è firmato con una chiave di prova: va bene per te e per i tuoi amici.
Per pubblicare su **Google Play** servono un account sviluppatore (25 $ una tantum) e un pacchetto firmato (AAB). Si crea da Android Studio con **Build → Generate Signed Bundle**.

---

## App nativa per iPhone (facoltativo)

Apple permette di installare app native solo tramite App Store o TestFlight. Servono:
- un Mac con Xcode;
- un account Apple Developer (99 $/anno) per distribuirla ad altri.

Dal Mac, nella cartella del progetto:

```
npm install
npm run ios
npx cap open ios
```

Xcode si apre. Scegli il tuo team in **Signing & Capabilities**, collega l'iPhone e premi ▶︎.
Senza account a pagamento l'app funziona sul tuo iPhone per 7 giorni.
Per la maggior parte degli usi la Strada 1 su iPhone dà lo stesso risultato, senza costi.

---

## Gruppo online, QR e chat

1. Nella scheda **Gruppo** tocca **Attiva gruppo online**.
2. Compare un **QR**: fallo inquadrare all'amico. Lui apre Conti Chiari, tocca il nome del gruppo in alto, poi **Scansiona QR**. In alternativa puoi mandargli il link con **Invia link**.
3. Ognuno indica **chi è** nel gruppo e, in **Impostazioni → Il tuo profilo**, sceglie foto, nome e messaggio pubblico.
4. Da quel momento spese, rimborsi e messaggi nella scheda **Chat** arrivano a tutti da soli.

Su iPhone il link aperto dalla fotocamera di sistema apre Safari, non l'app installata. Per questo conviene usare **Scansiona QR** dentro l'app.

## Come si usa

- **Gruppo** (scheda in basso): aggiungi le persone e rinomina il gruppo.
- **Spese**: tocca **+**, scrivi cosa, quanto, chi ha pagato e tra chi dividere.
- **Saldi**: vedi chi deve a chi, spunta i pagamenti fatti e invia il riepilogo in chat.
- **Più gruppi**: tocca il nome del gruppo in alto per cambiarlo o crearne uno nuovo (viaggio, casa, cene…).
- **Condividere un gruppo**: Gruppo → **Invia codice del gruppo**. Chi lo riceve tocca il nome del gruppo in alto → **Importa gruppo da un codice** e incolla. Se il gruppo esiste già sul suo telefono, viene aggiornato.

Il codice è una fotografia del gruppo in quel momento. Conviene che una sola persona registri le spese e reinvii il codice quando cambia qualcosa.

## Contenuto della cartella

| Percorso | A cosa serve |
|---|---|
| `www/` | L'app vera e propria (pagina, icone, funzionamento offline) |
| `assets/` | Icone e schermata di avvio per Android e iOS |
| `capacitor.config.json`, `package.json` | Configurazione per creare le app native |
| `.github/workflows/` | Le istruzioni che fanno costruire a GitHub l'APK e il sito |
