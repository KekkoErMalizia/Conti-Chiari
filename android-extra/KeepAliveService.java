package it.contichiari.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Attività in background: servizio in primo piano che tiene vivo il processo dell'app (e quindi la WebView
 * con le connessioni ai relay) anche a schermo spento o quando si passa a un'altra app, così le notifiche
 * dei messaggi arrivano subito. Android richiede una notifica fissa finché il servizio è attivo.
 * Si ferma quando l'app viene chiusa dall'elenco delle app recenti: senza la WebView non avrebbe niente da fare.
 */
public class KeepAliveService extends Service {

    static final String CHANNEL = "attivita-in-background";
    static final int NOTIFICATION_ID = 7301;
    static final String PREFS = "conti-chiari-background";
    static volatile boolean running;

    static void start(Context ctx, String title, String text) {
        ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("title", title).putString("text", text).apply();
        Intent intent = new Intent(ctx, KeepAliveService.class);
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent);
        else ctx.startService(intent);
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, KeepAliveService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String title = prefs.getString("title", "Conti Chiari");
        String text = prefs.getString("text", "");

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, title, NotificationManager.IMPORTANCE_MIN);
            channel.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        // icona di Conti Chiari nella barra di stato (res/drawable/ic_stat_contichiari.xml, copiata dal workflow)
        int icon = getResources().getIdentifier("ic_stat_contichiari", "drawable", getPackageName());
        b.setSmallIcon(icon != 0 ? icon : android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(tap)
            .setOngoing(true)
            .setShowWhen(false);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_MIN);

        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, b.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
        else startForeground(NOTIFICATION_ID, b.build());
        running = true;
        // se Android chiude il processo non lo fa ripartire da solo: senza l'app aperta il servizio sarebbe inutile
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
