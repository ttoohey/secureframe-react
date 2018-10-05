import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Iframe from 'react-iframe'
import moment from 'moment'
import { Base64 } from 'js-base64'

const TXN_TYPE_PREAUTH = '1'
const TXN_TYPE_STORE = '8'
const STORE_TYPE_PAYOR = 'payor'
const SUMMARYCODE_APPROVED = '1'
const SUMMARYCODE_DECLINEDBYBANK = '2'
const SUMMARYCODE_DECLINEDOTHER = '3'
const SUMMARYCODE_CANCELLED = '4'

function mapHidden (inputs) {
  return Object.entries(inputs).map(([ name, value]) => {
    return value === undefined ? null : `<input type="hidden" name="${htmlEntities(name)}" value="${htmlEntities(value)}" />`
  }).filter(value => value !== null)
}

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

class SecureFrame extends Component {
  
  static propTypes = {
    live: PropTypes.bool,
    merchantId: PropTypes.string,
    title: PropTypes.string,
    image: PropTypes.string,
    referenceName: PropTypes.string,
    cardTypes: PropTypes.string,
    template: PropTypes.string,
    returnUrl: PropTypes.string,
    styleUrl: PropTypes.string
  }
  
  static defaultProps = {
    live: false,
  }
  
  constructor (props) {
    super(props)
    this.state = {
      txn_type: props.store ? TXN_TYPE_STORE : TXN_TYPE_PREAUTH,
      store_type: STORE_TYPE_PAYOR,
      primary_ref: null,
      payor: null,
      amount: null,
      fingerprint: null,
      fp_timestamp: null
    }
    this.receiveMessage = this.receiveMessage.bind(this)
  }
  
  componentWillMount () {
    this.makeFingerprint()
  }
  
  componentDidMount () {
    window.addEventListener('message', this.receiveMessage, false)
    this._isMounted = true
  }
  
  componentWillUnmount () {
    window.removeEventListener('message', this.receiveMessage, false)
    this._isMounted = false
  }
  
  componentWillReceiveProps (nextProps) {
    this.makeFingerprint(nextProps)
  }
  
  receiveMessage (event) {
    if (!event.data || event.data.source !== 'secureframe') {
      return
    }
    const { store_type, txn_type, fp_timestamp } = this.state
    let response = event.data.payload
    if (event.data.encoding === 'base64') {
      response = JSON.parse(Base64.decode(response))
      if (response.summarycode === '1' && txn_type === TXN_TYPE_STORE) {
        response.subject = `${store_type}|${response.payor}|${fp_timestamp}|${response.summarycode}`
      } else {
        response.subject = `${response.refid}|${response.amount}|${response.timestamp}|${response.summarycode}`
      }
    }
    this.onPayment(response)
    this.setState({ fingerprint: null })
    this.makeFingerprint()
  }
  
  onPayment (response) {
    if (response.summarycode === SUMMARYCODE_APPROVED && this.props.onPaymentApproved) {
      return this.props.onPaymentApproved(response)
    }
    if ([SUMMARYCODE_DECLINEDBYBANK, SUMMARYCODE_DECLINEDOTHER].includes(response.summarycode) && this.props.onPaymentDeclined) {
      return this.props.onPaymentDeclined(response.restext, response)
    }
    if (response.summarycode === SUMMARYCODE_CANCELLED && this.props.onPaymentCancelled) {
      return this.props.onPaymentCancelled(response)
    }
    if (this.props.onPayment) {
      return this.props.onPayment(response)
    }
  }
  
  makeFingerprint (_props) {
    const props = _props || this.props
    const { txn_type, store_type } = this.state
    const primary_ref = props.reference
    let payor = props.payor
    const amount = props.amount || 100
    const fp_timestamp = moment.utc().format("YYYYMMDDHHMMSS");
    let subject
    if (txn_type === TXN_TYPE_STORE) {
      payor = payor || primary_ref
      subject = `${txn_type}|${store_type}|${payor}|${fp_timestamp}`
    } else {
      subject = `${txn_type}|${primary_ref}|${amount}|${fp_timestamp}`
    }
    const data = { txn_type, store_type, primary_ref, payor, amount, fp_timestamp }
    return props.onSignPayment(subject, data)
      .then(response => {
        let fingerprint, data
        if (typeof response === 'string') {
          fingerprint = response
        } else {
          fingerprint = response.fingerprint
          data = response
        }
        this._isMounted && this.setState({ primary_ref, payor, amount, fp_timestamp, ...data, fingerprint })
        return fingerprint
      })
  }
  
  render () {
    const { txn_type, store_type, primary_ref, payor, amount, fingerprint, fp_timestamp } = this.state
    const { merchantId, title, image, referenceName, cardTypes, template, returnUrl, styleUrl, ...props } = this.props
    
    if (fingerprint === null) {
      return null
    }
    
    const inputs = {
      bill_name: 'transact',
      merchant_id: merchantId,
      txn_type,
      store_type,
      primary_ref,
      payor,
      amount,
      fp_timestamp,
      fingerprint,
      store: 'yes',
      display_receipt: 'false',
      confirmation: 'false',
      card_types: cardTypes ? cardTypes.join('|') : undefined,
      title,
      primary_ref_name: referenceName || 'Customer reference',
      page_header_image: image,
      template: template || 'responsive',
      page_style_url: styleUrl || 'https://try.gency.com.au/tim/secureframe-react/style.css',
      return_url: returnUrl || 'https://try.gency.com.au/tim/secureframe-react/',
    }

    const transactionUrl = this.props.transactionUrl || 
      this.props.live
      ? 'https://payment.securepay.com.au/secureframe/invoice'
      : 'https://test.payment.securepay.com.au/secureframe/invoice'
    
    const launchHtml = `
      <!DOCTYPE html>
      <html><body onload="document.forms[0].submit()">
        <form action="${htmlEntities(transactionUrl)}" method="post">
        ${mapHidden(inputs).join('')}
        </form>
      </body></html>
    `
    return (
      <Iframe
        width="100%"
        height="420px"
        display="initial"
        position="relative"
        {...props}
        url={`data:text/html;base64,${btoa(launchHtml)}`}
      />
    )
  }
}

export default SecureFrame
