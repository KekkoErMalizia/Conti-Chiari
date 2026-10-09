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

1. Vai su **Actions → App Android (APK)** e apri l'esecuzione più recente. La prima volta impiega circa 5 minuti.
2. In fondo alla pagina, sotto **Artifacts**, scarica **ContiChiari-android**. È uno zip che contiene `ContiChiari.apk`.
3. Passa il file sul telefono, aprilo e consenti "Installa app sconosciute" quando Android lo chiede.

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
