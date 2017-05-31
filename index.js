import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Iframe from 'react-iframe'
import { PopupboxManager, PopupboxContainer } from 'react-popupbox'
import moment from 'moment'
import uuid from 'uuid'
import { Base64 } from 'js-base64'
import 'react-popupbox/dist/react-popupbox.css'

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
      txn_type: '8',
      store_type: 'payor',
      payor: null,
      buffer: null,
      fingerprint: null,
      fp_timestamp: null,
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
    if (!event.data || event.data.type !== 'secureframe') {
      console.warn('event data type not secureframe', event.data ? event.data.type : null)
      return
    }
    let response = event.data.payload
    if (event.data.encoding === 'base64') {
      response = JSON.parse(Base64.decode(response))
      if (['00', '08', '11'].includes(response.strescode)) {
        response.subject = `payor|${response.payor}|${this.state.fp_timestamp}|${response.summarycode}`
      } else {
        response.subject = `${response.refid}|${response.amount}|${response.timestamp}|${response.summarycode}`
      }
    }
    this.props.onPayment(response)
    this.closePopupbox()
  }
  
  makeFingerprint () {
    const { txn_type, store_type } = this.state
    const payor = this.props.payor || uuid.v4()
    const fp_timestamp = moment.utc().format("YYYYMMDDHHMMSS");
    const buffer = `${txn_type}|${store_type}|${payor}`
    return this.props.onSignPayment(`${buffer}|${fp_timestamp}`)
      .then(fingerprint => this.setState({ buffer, payor, fingerprint, fp_timestamp }))
  }
  
  handleClosed () {
    this.setState({ fingerprint: null })
    this.content = null
  }
  
  openPopupbox () {
    this.makeFingerprint().then(() => {
      PopupboxManager.open({
        content: this.content,
        config: {
          fadeIn: true,
          fadeInSpeed: 300,
        },
      })
    })
  }
  
  closePopupbox () {
    PopupboxManager.close()
  }
  
  render () {
    if (this.state.fingerprint !== null && this.content === null) {
      this.content = this.renderContent()
    }
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
  
  renderContent () {
    const { txn_type, store_type, payor, fingerprint, fp_timestamp } = this.state
    const { merchantId, title, image, referenceName, cardTypes, reference, template, returnUrl, styleUrl } = this.props
    const amount = this.props.amount || '100'
    
    const inputs = {
      bill_name: 'transact',
      title,
      primary_ref_name: referenceName || 'Customer',
      primary_ref: reference,
      page_header_image: image,
      merchant_id: merchantId,
      txn_type,
      amount,
      store: 'yes',
      display_receipt: 'false',
      confirmation: 'false',
      store_type,
      payor,
      fp_timestamp,
      fingerprint,
      return_url: returnUrl || 'https://try.gency.com.au/tim/secureframe-react/',
      card_types: cardTypes ? cardTypes.join('|') : undefined,
      template: template || 'responsive',
      page_style_url: styleUrl || 'https://try.gency.com.au/tim/secureframe-react/style.css',
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
        ref={'frame'}
        width="100%"
        height="420px"
        display="initial"
        position="relative"
      />
    )
  }
  
}

export default SecureFrame
