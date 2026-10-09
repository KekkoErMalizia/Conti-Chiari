package it.contichiari.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Mostra il motivo dell'ultimo arresto dell'app, con i pulsanti per condividerlo e per riprovare.
 * Volutamente senza librerie (solo Android di base) e nel processo separato ":crash", così funziona
 * anche quando il processo principale dell'app non riesce ad avviarsi.
 */
public class CrashActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String saved = CrashGuard.lastCrash(this);
        final String report = saved != null ? saved : "Conti Chiari\n\n" + CrashGuard.deviceInfo(this);

        String intro = "L'app si è chiusa mentre partiva. Tocca «Condividi» e invia questo testo allo sviluppatore: serve a capire cosa correggere."
            + "\n\nPuoi anche provare ad aprire il Play Store e aggiornare (o attivare, se è disattivata) «Google Chrome» e «Android System WebView», poi toccare «Riprova».";

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
            CrashGuard.clear(this);
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
