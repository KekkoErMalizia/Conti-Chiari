package it.contichiari.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin «Notify»: crea i canali delle notifiche con suono e vibrazione espliciti (il plugin LocalNotifications
 * non sa impostare il suono predefinito del telefono), dice se il telefono li ha resi silenziosi e apre le
 * impostazioni di sistema del canale per riattivarli.
 */
@CapacitorPlugin(name = "Notify")
public class NotifyPlugin extends Plugin {

    static final String MSG = "messaggi-v2", EXP = "spese-v2", UPD = "aggiornamenti-v2";
    static final long[] VIBRATION = {0, 300, 150, 300};

    @PluginMethod
    public void channels(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes chat = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            AudioAttributes event = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build();
            make(nm, MSG, call.getString("msgs", "Messaggi"), NotificationManager.IMPORTANCE_HIGH, sound, chat);
            make(nm, EXP, call.getString("exp", "Spese"), NotificationManager.IMPORTANCE_HIGH, sound, event);
            make(nm, UPD, call.getString("upd", "Aggiornamenti"), NotificationManager.IMPORTANCE_DEFAULT, sound, event);
            // canali della versione precedente, creati senza suono esplicito: le impostazioni di un canale non si possono più cambiare
            for (String old : new String[] {"messaggi", "spese", "aggiornamenti"}) nm.deleteNotificationChannel(old);
        }
        call.resolve(state());
    }

    private void make(NotificationManager nm, String id, String name, int importance, Uri sound, AudioAttributes attrs) {
        NotificationChannel c = new NotificationChannel(id, name, importance);
        c.setSound(sound, attrs);
        c.enableVibration(true);
        c.setVibrationPattern(VIBRATION);
        c.enableLights(true);
        c.setLightColor(0xFF1F5F6B);
        c.setShowBadge(true);
        c.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(c);   // se esiste già cambia solo il nome: le scelte dell'utente restano
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(state());
    }

    /** Il canale dei messaggi suona e vibra davvero? (il telefono o l'utente possono averlo reso silenzioso) */
    private JSObject state() {
        JSObject r = new JSObject();
        boolean sound = true, vibrate = true, enabled = true;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            enabled = nm.areNotificationsEnabled();
            NotificationChannel c = nm.getNotificationChannel(MSG);
            if (c != null) {
                enabled = enabled && c.getImportance() != NotificationManager.IMPORTANCE_NONE;
                sound = c.getSound() != null && c.getImportance() >= NotificationManager.IMPORTANCE_DEFAULT;
                vibrate = c.shouldVibrate();
            }
        }
        r.put("enabled", enabled);
        r.put("sound", sound);
        r.put("vibrate", vibrate);
        return r;
    }

    /** Apre le impostazioni di sistema del canale dei messaggi (o delle notifiche dell'app). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String pkg = getContext().getPackageName();
        Intent i;
        if (Build.VERSION.SDK_INT >= 26) {
            i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
                .putExtra(Settings.EXTRA_CHANNEL_ID, call.getString("channel", MSG));
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (ActivityNotFoundException e) {
            try {
                getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException ignored) {}
        }
        call.resolve();
    }
}
