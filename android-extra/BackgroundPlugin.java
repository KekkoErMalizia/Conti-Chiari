package it.contichiari.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Plugin «Background» per il JavaScript: avvia e ferma l'attività in background e gestisce l'ottimizzazione della batteria. */
@CapacitorPlugin(name = "Background")
public class BackgroundPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        try {
            KeepAliveService.start(getContext(), call.getString("title", "Conti Chiari"), call.getString("text", ""));
            call.resolve(state());
        } catch (Exception e) {
            call.reject("Impossibile avviare l'attività in background: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        KeepAliveService.stop(getContext());
        call.resolve(state());
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(state());
    }

    /** Apre la richiesta di sistema per escludere l'app dall'ottimizzazione della batteria (o, se manca, l'elenco). */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent ask = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
        ask.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(ask);
        } catch (ActivityNotFoundException e) {
            Intent list = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(list); } catch (ActivityNotFoundException ignored) {}
        }
        call.resolve(state());
    }

    private JSObject state() {
        PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("running", KeepAliveService.running);
        r.put("batteryOk", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        return r;
    }
}
