package it.contichiari.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Prima schermata dell'app (icona nel launcher), senza librerie e nel processo separato ":crash":
 * se l'ultimo avvio è fallito apre il rapporto (CrashActivity), altrimenti l'app vera (MainActivity).
 * Così il rapporto si vede anche quando è il processo principale (Capacitor, WebView) a non partire.
 */
public class StartActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean crashed = CrashGuard.lastCrashExists(this);
        Intent next = new Intent(this, crashed ? CrashActivity.class : MainActivity.class);
        if (!crashed && getIntent() != null && getIntent().getExtras() != null) next.putExtras(getIntent().getExtras());
        startActivity(next);
        finish();
        overridePendingTransition(0, 0);
    }
}
