<?php
/**
 * ZLR website contact handler.
 * Receives POST from the site forms, sends a notification email via
 * Gmail SMTP (PHPMailer), responds with JSON for the fetch() call.
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

header('Content-Type: application/json; charset=utf-8');

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

// ---------- Configuration ----------
$CONFIG_FILE = dirname(__DIR__) . '/zlr-mail-config.php';
$MAILER_DIR  = dirname(__DIR__) . '/phpmailer';
$FAIL_LOG    = dirname(__DIR__) . '/contact-fail.log';   // outside webroot
$SUBJECT     = 'New enquiry — Zambia Lobito Railway website';

// ---------- Honeypot ----------
if (!empty($_POST['website'])) {
    // Silently accept then drop — bots don't need to know.
    echo json_encode(['ok' => true]);
    exit;
}

// ---------- Collect & sanitise ----------
function clean($v) { return trim(strip_tags((string)$v)); }

$name    = clean($_POST['name']         ?? '');
$email   = clean($_POST['email']        ?? '');
$org     = clean($_POST['organisation'] ?? '');
$message = clean($_POST['message']      ?? '');

if ($name === '' || $email === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid email address']);
    exit;
}

// Length guards
if (strlen($name) > 200 || strlen($email) > 254 || strlen($org) > 200 || strlen($message) > 5000) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Field too long']);
    exit;
}

// ---------- Build email ----------
$ip   = $_SERVER['REMOTE_ADDR']     ?? 'unknown';
$ua   = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
$now  = date('Y-m-d H:i:s');

$body  = "A new enquiry has been submitted via the Zambia Lobito Railway website.\n\n";
$body .= "Name:         $name\n";
$body .= "Email:        $email\n";
$body .= "Organisation: " . ($org !== '' ? $org : '—') . "\n";
$body .= "----------------------------------------\n";
$body .= "Message:\n$message\n";
$body .= "----------------------------------------\n";
$body .= "Submitted:    $now\n";
$body .= "IP:           $ip\n";
$body .= "User Agent:   $ua\n";

// Header-injection guards
$safeEmail = preg_replace('/[\r\n]+/', '', $email);
$safeName  = preg_replace('/[\r\n]+/', ' ', $name);

// ---------- HTML version ----------
$hName  = htmlspecialchars($name,  ENT_QUOTES, 'UTF-8');
$hEmail = htmlspecialchars($safeEmail, ENT_QUOTES, 'UTF-8');
$hOrg   = htmlspecialchars($org !== '' ? $org : '—', ENT_QUOTES, 'UTF-8');
$hMsg   = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
$hMeta  = htmlspecialchars("$now  ·  IP $ip", ENT_QUOTES, 'UTF-8');

$html = <<<HTML
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef1f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="background-color:#0a1628;padding:22px 30px;" align="left">
            <img src="https://zambialobitorail.com/assets/img/zlr-logo.png" alt="Zambia Lobito Railway" height="42" style="display:block;height:42px;border:0;">
          </td>
        </tr>
        <tr><td style="background-color:#fcc00c;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 30px 8px 30px;">
            <div style="font-size:20px;font-weight:bold;color:#0a1628;">New website enquiry</div>
            <div style="font-size:13px;color:#6b7280;padding-top:6px;">Submitted via the Zambia Lobito Railway website contact form</div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 30px 0 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">
              <tr>
                <td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;width:130px;vertical-align:top;">Name</td>
                <td style="padding:8px 0;font-size:15px;color:#111827;">{$hName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Email</td>
                <td style="padding:8px 0;font-size:15px;"><a href="mailto:{$hEmail}" style="color:#0a5bd3;text-decoration:none;">{$hEmail}</a></td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Organisation</td>
                <td style="padding:8px 0;font-size:15px;color:#111827;">{$hOrg}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 30px 0 30px;">
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;padding-bottom:8px;">Message</div>
            <div style="background-color:#f6f8fa;border-left:3px solid #fcc00c;padding:16px 18px;font-size:15px;line-height:1.6;color:#1f2937;">{$hMsg}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 30px 26px 30px;">
            <div style="font-size:13px;color:#6b7280;">Reply to this email to respond directly to {$hName}.</div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f2f4f7;padding:14px 30px;">
            <div style="font-size:12px;color:#8a94a3;">{$hMeta}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;

// ---------- Send via Gmail SMTP ----------
$cfg  = is_file($CONFIG_FILE) ? (require $CONFIG_FILE) : null;
$sent = false;
$sendError = '';

if (is_array($cfg) && strpos($cfg['smtp_user'], '@') !== false) {
    require_once $MAILER_DIR . '/Exception.php';
    require_once $MAILER_DIR . '/PHPMailer.php';
    require_once $MAILER_DIR . '/SMTP.php';

    $m = new PHPMailer(true);
    try {
        $m->isSMTP();
        $m->Host       = 'smtp.gmail.com';
        $m->SMTPAuth   = true;
        $m->Username   = $cfg['smtp_user'];
        $m->Password   = $cfg['smtp_pass'];
        $m->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $m->Port       = 587;
        $m->Timeout    = 12;
        $m->CharSet    = 'UTF-8';

        $m->setFrom($cfg['smtp_user'], $cfg['from_name']);
        foreach ($cfg['to'] as $rcpt) {
            $m->addAddress($rcpt);
        }
        $m->addReplyTo($safeEmail, $safeName);
        $m->Subject = $SUBJECT;
        $m->isHTML(true);
        $m->Body    = $html;
        $m->AltBody = $body;   // plain-text fallback

        $sent = $m->send();
    } catch (MailException $e) {
        $sendError = $m->ErrorInfo !== '' ? $m->ErrorInfo : $e->getMessage();
    } catch (\Exception $e) {
        $sendError = $e->getMessage();
    }
} else {
    $sendError = 'Mailer not configured';
}

if ($sent) {
    echo json_encode(['ok' => true]);
} else {
    // Log outside the webroot so enquiries are never lost or exposed
    @file_put_contents(
        $FAIL_LOG,
        "[$now] FAILED MAIL ($sendError) — $email — $name\n$message\n\n",
        FILE_APPEND | LOCK_EX
    );
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Mail send failed']);
}
