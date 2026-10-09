package it.contichiari.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Plugin «Updater»: scarica l'aggiornamento dell'app (APK della Release su GitHub) dentro l'app e apre subito
 * l'installazione di Android. Android chiede comunque di confermare con «Installa» (e, la prima volta, di
 * consentire a Conti Chiari di installare app): un'app non può installarsi da sola senza conferma.
 * L'aggiornamento si installa sopra la versione attuale, con la stessa firma, quindi i dati restano.
 */
@CapacitorPlugin(name = "Updater")
public class UpdatePlugin extends Plugin {

    /** Conti Chiari può già aprire l'installazione di un APK? (Android 8+ lo chiede una volta per app) */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    /** Apre la pagina di sistema «Installa app sconosciute» per Conti Chiari. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); } catch (ActivityNotFoundException ignored) {}
        }
        call.resolve();
    }

    /** Scarica l'APK (solo da github.com, con avanzamento «updateProgress») e apre l'installazione. */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url", "");
        if (!url.startsWith("https://github.com/")) {
            call.reject("Indirizzo dell'aggiornamento non valido");
            return;
        }
        final Context ctx = getContext();
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                // Android 7+: file nella cache interna, condiviso con l'installatore tramite FileProvider; Android 6: cache esterna
                File dir = Build.VERSION.SDK_INT >= 24 ? new File(ctx.getCacheDir(), "updates") : ctx.getExternalCacheDir();
                if (dir == null) throw new Exception("memoria non disponibile");
                dir.mkdirs();
                File apk = new File(dir, "ContiChiari.apk");
                c = (HttpURLConnection) new URL(url).openConnection();   // GitHub reindirizza al file vero (https → https)
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                int code = c.getResponseCode();
                if (code != 200) throw new Exception("HTTP " + code);
                int total = c.getContentLength();
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    long done = 0;
                    int n, last = -1;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != last) {
                            last = pct;
                            JSObject p = new JSObject();
                            p.put("pct", pct);
                            notifyListeners("updateProgress", p);
                        }
                    }
                }
                Uri uri = Build.VERSION.SDK_INT >= 24
                    ? FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk)
                    : Uri.fromFile(apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                ctx.startActivity(install);
                call.resolve();
            } catch (Exception e) {
                call.reject("Download non riuscito: " + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }
}
