package it.contichiari.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Attività principale (Capacitor), con in più i plugin «Background» (attività in background) e «Updater» (aggiornamenti) «Notify» (canali delle notifiche con suono e vibrazione) e «ShareText» (pannello di condivisione di Android). */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundPlugin.class);
        registerPlugin(UpdatePlugin.class);
        registerPlugin(NotifyPlugin.class);
        registerPlugin(SharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
