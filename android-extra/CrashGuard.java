package it.contichiari.app;

import android.app.Application;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Rilevatore di arresti dell'app Android.
 * Nel processo principale (quello di Capacitor e della WebView) segna l'avvio in un file e lo cancella dopo
 * qualche secondo: se il file resta, l'app è morta mentre partiva, anche per errori nativi della WebView.
 * Gli errori Java vengono scritti per intero. StartActivity e CrashActivity girano nel processo separato
 * ":crash", così il rapporto si apre anche quando il processo principale non riesce a partire.
 * Copiato nel progetto Android da .github/workflows/android-apk.yml.
 */
public class CrashGuard extends Application {

    static final String STARTING = "avvio-in-corso.txt";
    static final String REPORT = "rapporto-arresto.txt";
    static final long STARTUP_MS = 10000;

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        if (processName().contains(":")) return;   // solo nel processo principale
        final File dir = base.getFilesDir();
        write(new File(dir, STARTING), "" + System.currentTimeMillis());
        new Handler(Looper.getMainLooper()).postDelayed(() -> new File(dir, STARTING).delete(), STARTUP_MS);

        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter trace = new StringWriter();
                error.printStackTrace(new PrintWriter(trace));
                write(new File(dir, REPORT), "Errore Java:\n" + trace);
            } catch (Throwable ignored) {}
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    static boolean lastCrashExists(Context ctx) {
        File dir = ctx.getFilesDir();
        return new File(dir, REPORT).exists() || new File(dir, STARTING).exists();
    }

    /** Il rapporto dell'ultimo avvio fallito, oppure null se l'ultimo avvio è andato bene. */
    static String lastCrash(Context ctx) {
        File dir = ctx.getFilesDir();
        File report = new File(dir, REPORT), starting = new File(dir, STARTING);
        if (!report.exists() && !starting.exists()) return null;
        String text = report.exists() ? read(report)
            : "L'app si è chiusa nei primi secondi senza un errore Java (arresto nativo, di solito della WebView).";
        return "Conti Chiari — rapporto di arresto\n\n" + text + "\n\n" + deviceInfo(ctx) + "\n\n--- Registro (logcat) ---\n" + logcat();
    }

    static void clear(Context ctx) {
        new File(ctx.getFilesDir(), REPORT).delete();
        new File(ctx.getFilesDir(), STARTING).delete();
    }

    /** Versioni di Android, dell'app, di Chrome e della WebView (con lo stato attivata/disattivata). */
    static String deviceInfo(Context ctx) {
        StringBuilder s = new StringBuilder();
        s.append("Telefono: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append('\n');
        s.append("Android: ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n");
        PackageManager pm = ctx.getPackageManager();
        s.append("App: ").append(version(pm, ctx.getPackageName())).append('\n');
        s.append("Google Chrome: ").append(version(pm, "com.android.chrome")).append('\n');
        s.append("Android System WebView: ").append(version(pm, "com.google.android.webview")).append('\n');
        s.append("WebView di sistema: ").append(version(pm, "com.android.webview")).append('\n');
        s.append("Samsung Internet: ").append(version(pm, "com.sec.android.app.sbrowser"));
        return s.toString();
    }

    private static String version(PackageManager pm, String pkg) {
        try {
            PackageInfo info = pm.getPackageInfo(pkg, 0);
            boolean enabled = info.applicationInfo == null || info.applicationInfo.enabled;
            return info.versionName + (enabled ? "" : " (DISATTIVATA)");
        } catch (Throwable e) {
            return "non installata";
        }
    }

    /** Le ultime righe del registro di sistema dell'app (un'app può leggere il proprio senza permessi). */
    private static String logcat() {
        try {
            Process p = Runtime.getRuntime().exec(new String[] {"logcat", "-d", "-v", "time", "-t", "300"});
            BufferedReader in = new BufferedReader(new InputStreamReader(p.getInputStream()));
            StringBuilder s = new StringBuilder();
            for (String line; (line = in.readLine()) != null; ) s.append(line).append('\n');
            return s.length() > 0 ? s.toString() : "(vuoto)";
        } catch (Throwable e) {
            return "(non disponibile: " + e + ")";
        }
    }

    private static String processName() {
        try {
            String s = read(new File("/proc/self/cmdline"));
            int end = s.indexOf('\0');
            return (end >= 0 ? s.substring(0, end) : s).trim();
        } catch (Throwable e) {
            return "";
        }
    }

    private static void write(File f, String text) {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(text.getBytes("UTF-8"));
            out.getFD().sync();
        } catch (Throwable ignored) {}
    }

    private static String read(File f) {
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[(int) Math.max(f.length(), 4096)];
            int n = in.read(buf);
            return n > 0 ? new String(buf, 0, n, "UTF-8") : "";
        } catch (Throwable e) {
            return "";
        }
    }
}
