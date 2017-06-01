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
    onSignPayment={subject => handleSignPayment(subject)}
    onPayment={payload => handlePayment(payload)}
  />
)
```

The `onSignPayment` property is a callback that must return a promise that resolves
with the SHA-1 fingerprint. The SecurePay Merchant ID and Transaction Password must
be prepended to the plaintext and the result run through a SHA-1 digest. This would
typically be performed on a server where the Transaction Password is securely stored.

```
function handleSignPayment (subject) {
  return fetch('/sign-payment', {
    method: 'POST',
    body: subject
  })
  .then(response => response.json())
  .then(json => json.fingerprint)
}
```

The `onPayment` property is a callback that is triggered when the iframe posts a
message to the React container (as described above). This is typically done when
the customer completes the SecureFrame hosted payment form. The optional payload
field contains data provided by the page handling the final POST of the payment
form.
