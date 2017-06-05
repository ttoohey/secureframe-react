import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Iframe from 'react-iframe'
import { PopupboxManager, PopupboxContainer } from 'react-popupbox'
import moment from 'moment'
import uuid from 'uuid'
import { Base64 } from 'js-base64'
import 'react-popupbox/dist/react-popupbox.css'
import './secureframe-react.css'

function mapHidden (inputs) {
  return Object.entries(inputs).map(([n, v]) => {
    return v === undefined ? null : `<input type="hidden" name="${htmlEntities(n)}" value="${htmlEntities(v)}" />`
  }).filter(v => v !== null)
}

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

class SecureFrame extends Component {
  
  static propTypes = {
    live: PropTypes.bool,
  }
  
  static defaultProps = {
    live: false,
  }
  
  constructor (props) {
    super(props)
    this.content = null
    this.state = {
      txn_type: '1',
      store_type: 'payor',
      payor: null,
      buffer: null,
      fingerprint: null,
      fp_timestamp: null,
      error: null
    }
    this.receiveMessage = this.receiveMessage.bind(this)
  }
  
  componentDidMount () {
    window.addEventListener('message', this.receiveMessage, false)
  }
  
  componentWillUnmount () {
    window.removeEventListener('message', this.receiveMessage, false)
  }
  
  receiveMessage (event) {
    if (!event.data || event.data.source !== 'secureframe') {
      return
    }
    const { store_type, fp_timestamp } = this.state
    let response = event.data.payload
    if (event.data.encoding === 'base64') {
      response = JSON.parse(Base64.decode(response))
      if (response.summarycode === '1') {
        if (store_type === '8') {
          response.subject = `${store_type}|${response.payor}|${fp_timestamp}|${response.summarycode}`
        } else {
          response.subject = `${response.refid}|${response.amount}|${response.timestamp}|${response.summarycode}`
        }
        (this.props.onPaymentApproved || this.props.onPayment)(response)
        this.closePopupbox()
      } else if (response.summarycode === '2' || response.summarycode === '3') {
        (this.props.onPaymentDeclined || this.props.onPayment)(response)
        PopupboxManager.update({ content: this.renderError(response.restext) })
      } else {
        (this.props.onPaymentCancelled || this.props.onPayment)(response)
        this.closePopupbox()
      }
    } else {
      this.props.onPayment && this.props.onPayment(response)
      this.closePopupbox()
    }
  }
  
  makeFingerprint () {
    const { txn_type, store_type } = this.state
    const payor = this.props.payor || uuid.v4()
    const primary_ref = this.props.reference || uuid.v4()
    const amount = this.props.amount || 100
    const fp_timestamp = moment.utc().format("YYYYMMDDHHMMSS");
    let subject
    if (txn_type === '8') {
      subject = `${txn_type}|${store_type}|${payor}|${fp_timestamp}`
    } else {
      subject = `${txn_type}|${primary_ref}|${amount}|${fp_timestamp}`
    }
    return this.props.onSignPayment(subject)
      .then(fingerprint => this.setState({ primary_ref, payor, amount, fp_timestamp, fingerprint }))
  }
  
  handleClosed () {
    this.setState({ fingerprint: null })
    this.content = null
  }
  
  openPopupbox () {
    this.makeFingerprint().then(() => {
      PopupboxManager.open({
        content: this.renderContent(),
        config: {
          fadeIn: true,
          fadeInSpeed: 300,
        },
      })
    })
  }
  
  closePopupbox () {
    this.content = null
    this.setState({ error: null, fingerprint: null })
    PopupboxManager.close()
  }
  
  reset () {
    this.content = null
    this.setState({ error: null, fingerprint: null })
    this.makeFingerprint().then(() => {
      PopupboxManager.update({
        content: this.renderContent()
      })
    })
  }
  
  render () {
    const button = React.cloneElement(
      this.props.children || <button className={this.props.buttonClassName} style={this.props.buttonStyle}>{this.props.buttonLabel || 'Set Card'}</button>,
      {[this.props.triggerEvent || 'onClick'] : () => this.openPopupbox()}
    )
    return (
      <div>
        {button}
        <PopupboxContainer
          onClosed={() => this.handleClosed()}
          />
      </div>
    )
    
  }
  
  renderError (error) {
    let buttons = this.props.errorButtons
    if (!buttons) {
      buttons = [
        <button key={0}>Retry</button>,
        <button key={1}>Close</button>
      ]
    }
    buttons[0] = React.cloneElement(buttons[0], {
      [this.props.triggerEvent || 'onClick'] : () => this.reset()
    })
    buttons[1] = React.cloneElement(buttons[1], {
      [this.props.triggerEvent || 'onClick'] : () => this.closePopupbox()
    })
    return (
      <div className='error'>
        <label>Transaction declined</label>
        <div className='message'>
          <p>
            We could not complete the transaction due to the following:
          </p>
          <span>{error}</span>
          <p>
            Please check your card details and try again.
          </p>
        </div>
        <div className='buttons'>{buttons}</div>
      </div>
    )
  }
  
  renderContent () {
    const { txn_type, store_type, primary_ref, payor, amount, fingerprint, fp_timestamp } = this.state
    const { merchantId, title, image, referenceName, cardTypes, template, returnUrl, styleUrl } = this.props
    
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
      primary_ref_name: referenceName || 'Customer',
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
        <form action="${transactionUrl}" method="post">
        ${mapHidden(inputs).join('')}
        </form>
      </body></html>
    `
    return (
      <Iframe url={`data:text/html;base64,${btoa(launchHtml)}`}
        width="100%"
        height="420px"
        display="initial"
        position="relative"
      />
    )
  }
  
}

export default SecureFrame
