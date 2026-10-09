package it.contichiari.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Attività principale (Capacitor), con in più i plugin «Background» (attività in background) e «Updater» (aggiornamenti). */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundPlugin.class);
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
