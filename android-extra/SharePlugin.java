package it.contichiari.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin «ShareText»: apre il pannello di condivisione di Android (WhatsApp, Telegram, SMS, email...).
 * La WebView dell'app non ha navigator.share, quindi senza questo plugin «Invia link» poteva solo copiare il testo.
 */
@CapacitorPlugin(name = "ShareText")
public class SharePlugin extends Plugin {
    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "");
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, text);
            if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
            Intent chooser = Intent.createChooser(send, title == null || title.isEmpty() ? null : title);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share failed", e);
        }
    }
}
