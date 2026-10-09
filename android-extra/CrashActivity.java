package it.contichiari.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Mostra il motivo dell'ultimo arresto dell'app, con i pulsanti per condividerlo e per riprovare.
 * Volutamente senza librerie (solo Android di base) e in un processo separato, così funziona anche
 * quando il resto dell'app non riesce ad avviarsi.
 */
public class CrashActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final SharedPreferences prefs = getSharedPreferences(CrashGuard.PREFS, MODE_PRIVATE);
        String saved = prefs.getString(CrashGuard.KEY_REPORT, null);
        final String report = "Conti Chiari — rapporto di arresto\n\n" + (saved != null ? saved : CrashGuard.deviceInfo(this));

        boolean webview = report.contains("WebView") || report.contains("webview") || report.contains("DISATTIVATA");
        String intro = "L'app si è chiusa per un errore. Tocca «Condividi» e invia questo testo allo sviluppatore: serve a capire cosa correggere.";
        if (webview) intro += "\n\nSpesso la causa è la WebView: apri il Play Store e aggiorna (o attiva, se è disattivata) «Google Chrome» e «Android System WebView», poi tocca «Riprova».";

        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Conti Chiari");
        title.setTextSize(22);
        box.addView(title);

        TextView text = new TextView(this);
        text.setText(intro);
        text.setTextSize(16);
        text.setPadding(0, pad / 2, 0, pad);
        box.addView(text);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        Button share = new Button(this);
        share.setText("Condividi");
        share.setOnClickListener(v -> {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, "Conti Chiari — rapporto di arresto");
            send.putExtra(Intent.EXTRA_TEXT, report);
            startActivity(Intent.createChooser(send, "Condividi"));
        });
        Button retry = new Button(this);
        retry.setText("Riprova");
        retry.setOnClickListener(v -> {
            prefs.edit().remove(CrashGuard.KEY_REPORT).commit();
            Intent open = new Intent(this, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(open);
            finish();
        });
        buttons.addView(share);
        buttons.addView(retry);
        box.addView(buttons);

        TextView details = new TextView(this);
        details.setText(report);
        details.setTextSize(12);
        details.setTextIsSelectable(true);
        details.setPadding(0, pad, 0, 0);
        box.addView(details);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(box, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
    }
}
