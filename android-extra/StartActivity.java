package it.contichiari.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

/**
 * Prima schermata dell'app (icona nel launcher), senza librerie: se l'ultimo avvio è finito con un
 * arresto apre il rapporto (CrashActivity), altrimenti l'app vera (MainActivity, Capacitor).
 * Così il rapporto si vede anche quando è proprio Capacitor o la WebView a non partire.
 */
public class StartActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SharedPreferences prefs = getSharedPreferences(CrashGuard.PREFS, MODE_PRIVATE);
        boolean crashed = prefs.getString(CrashGuard.KEY_REPORT, null) != null;
        // da qui l'app conta come «aperta»: se si chiude prima di tornare in secondo piano, è un arresto
        if (!crashed) prefs.edit().putBoolean(CrashGuard.KEY_FOREGROUND, true).commit();
        Intent next = new Intent(this, crashed ? CrashActivity.class : MainActivity.class);
        if (getIntent() != null && getIntent().getExtras() != null && !crashed) next.putExtras(getIntent().getExtras());
        startActivity(next);
        finish();
        overridePendingTransition(0, 0);
    }
}
