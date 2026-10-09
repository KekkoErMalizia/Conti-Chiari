package it.contichiari.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Attività principale (Capacitor), con in più il plugin «Background» per l'attività in background. */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
