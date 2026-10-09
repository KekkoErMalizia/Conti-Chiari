package it.contichiari.app;

import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Rilevatore di arresti dell'app Android.
 * Se l'app si chiude per un errore, alla riapertura CrashActivity mostra il motivo e le versioni
 * di Android, Chrome e WebView, da condividere per capire cosa non va (senza computer né cavi).
 * Copiato nel progetto Android da .github/workflows/android-apk.yml.
 */
public class CrashGuard extends Application {

    static final String PREFS = "conti-chiari-crash";
    static final String KEY_REPORT = "report";
    static final String KEY_FOREGROUND = "foreground";

    @Override
    public void onCreate() {
        super.onCreate();
        final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        // la volta scorsa l'app era aperta e si è chiusa senza un errore Java: di solito è la WebView
        if (prefs.getBoolean(KEY_FOREGROUND, false) && prefs.getString(KEY_REPORT, null) == null) {
            prefs.edit()
                .putString(KEY_REPORT, "L'app si è chiusa senza un messaggio di errore Java (arresto della WebView o del sistema).\n\n" + deviceInfo(this))
                .putBoolean(KEY_FOREGROUND, false)
                .commit();
        }

        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter trace = new StringWriter();
                error.printStackTrace(new PrintWriter(trace));
                prefs.edit()
                    .putString(KEY_REPORT, deviceInfo(CrashGuard.this) + "\n\n" + trace)
                    .putBoolean(KEY_FOREGROUND, false)
                    .commit();
                Intent intent = new Intent(CrashGuard.this, CrashActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
            } catch (Throwable ignored) {}
            // niente finestra «L'app continua a interrompersi»: il rapporto si apre da solo
            android.os.Process.killProcess(android.os.Process.myPid());
            System.exit(10);
        });
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
}
