# SecurePay SecureFrame React component

A React component to register a credit card with SecurePay.

# Installation

```
npm install secureframe-react
```

# Usage

```
import SecureFrame from 'secureframe-react'

const Payment = props => (
  <SecureFrame
    merchantId={props.merchantId}
    reference={props.customerName}
    payor={props.customerId}
    returnUrl='https://mydomain.com/secureframe-callback.php'
    onSignPayment={plaintext => fingerprint(plaintext)}
    onPayment={payload => handlePayment(payload)}
  />
)
```

The `returnUrl` field must contain URL for a page that will accept the POST response
from the payment form. This page redirects to a URL for a page containing javascript
to notify the React container that the payment is complete. This can be a static
page. A typical example would contain:

```
// secureframe-callback.php
<?php
handlePost();
redirect('http://mydomain.com/secureframe.html');
?>
```

```
// secureframe.html
<!DOCTYPE html>
<html>
  <body onload="window.parent.postMessage({type: 'secureframe'}, '*')"></body>
</html>
```

The redirect may choose to include data. This can be done by including a hash in the
redirect location and modifying the page to include the hash in the message. The
`payload` field will be supplied as an argument to the `onPayment` handler.

```
// secureframe-callback.php
<?php
$payload = handlePost();
redirect('http://mydomain.com/secureframe.html#' . $payload);
?>

// secureframe.html
<!DOCTYPE html>
<html>
  <body onload="window.parent.postMessage({type: 'secureframe', payload: window.location.hash.substring(1)}, '*')"></body>
</html>
```

The `onSignPayment` property is a callback that must return a promise that resolves
with the SHA-1 fingerprint. The SecurePay Merchant ID and Transaction Password must
be prepended to the plaintext and the result run through a SHA-1 digest. This would
typically be performed on a server where the Transaction Password is securely stored.

```
function handleSignPayment (plaintext) {
  return fetch('/sign-payment', {
    method: 'POST',
    body: plaintext
  })
  .then(response => response.json())
  .then(json => json.fingerprint)
}
```

The `onPayment` property is a callback that is triggered when the iframe posts a
message to the React container (as described above). This is typically done when
the customer completes the SecureFrame hosted payment form. The payload field
contains data that was provided via the URL hash segment in the redirect from
the `returnUrl`.

The application should close the payment form via the `onPayment` handler by setting
the `open` property to false.
