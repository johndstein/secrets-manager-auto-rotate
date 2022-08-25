/* eslint-disable no-new */
'use strict'

const assert = require('assert')
const { Rotator } = require('../')

describe('constructor', () => {
  it('should throw if no secret id', () => {
    assert.throws(() => { new Rotator() })
  })
  it('should throw if no client request token', () => {
    assert.throws(() => { new Rotator({ SecretId: 'foo' }) })
  })
  it('should throw if no step', () => {
    assert.throws(() => { new Rotator({ SecretId: 'foo', ClientRequestToken: 'bar' }) })
  })
  it('should construct properly', () => {
    new Rotator({
      SecretId: 'foo',
      ClientRequestToken: 'bar',
      Step: 'setSecret',
    })
  })
})
