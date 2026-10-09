package it.contichiari.app;

import com.getcapacitor.BridgeActivity;

/**
 * Attività principale (Capacitor). In più rispetto a quella generata: segna quando l'app è in primo piano,
 * per accorgersi anche degli arresti della WebView, che non passano dal gestore degli errori Java.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onResume() {
        getSharedPreferences(CrashGuard.PREFS, MODE_PRIVATE).edit().putBoolean(CrashGuard.KEY_FOREGROUND, true).commit();
        super.onResume();
    }

    @Override
    public void onStop() {
        super.onStop();
        getSharedPreferences(CrashGuard.PREFS, MODE_PRIVATE).edit().putBoolean(CrashGuard.KEY_FOREGROUND, false).commit();
    }
}
