'use strict'
const AWS = require('aws-sdk')
const sm = new AWS.SecretsManager()
const AWSCURRENT = 'AWSCURRENT'
const AWSPENDING = 'AWSPENDING'
class Rotator {
  constructor(event) {
    Object.assign(this, event)
    this.steps = ['createSecret', 'setSecret', 'testSecret', 'finishSecret']
    if (!this.SecretId) {
      throw new Error('SecretId required')
    }
    if (!this.ClientRequestToken) {
      throw new Error('ClientRequestToken required')
    }
    if (this.steps.indexOf(this.Step) === -1) {
      throw new Error(`Invalid Step: ${this.Step}. Must be one of ${this.steps}`)
    }
    console.log(JSON.stringify({ fn: 'constructor', info: this }))
  }
  // throws error if anything really not kosher. returns true if we
  // should keep going, false if not.
  async validateVersionStage() {
    this.metadata = await sm.describeSecret({ SecretId: this.SecretId }).promise()
    console.log(JSON.stringify({ fn: 'validateVersionStage', info: this.metadata }))
    /*
      {
        "ARN": "arn:aws:secretsmanager:us-west-2:185869774838:secret:jds/test/secret-tf0CKs",
        "Name": "jds/test/secret",
        "RotationEnabled": true,
        "RotationLambdaARN": "arn:aws:lambda:us-west-2:185869774838:function:jdssecretrotate",
        "RotationRules": {
          "AutomaticallyAfterDays": 1,
          "ScheduleExpression": "rate(1 days)"
        },
        "LastChangedDate": "2022-08-24T13:17:48.819Z",
        "LastAccessedDate": "2022-08-24T00:00:00.000Z",
        "Tags": [],
        "VersionIdsToStages": {
          "2c6c3c0a-6548-4be0-a421-a7705b0c60a6": [
            "AWSCURRENT"
          ],
          "d09a8131-7f63-4493-a2f5-895176836e16": [
            "AWSPENDING"
          ]
        },
        "CreatedDate": "2022-08-24T13:07:02.291Z"
      }
    */
    if (!this.metadata.RotationEnabled) {
      throw new Error('rotation not enabled')
    }
    if (!this.metadata.VersionIdsToStages[this.ClientRequestToken]) {
      throw new Error('invalid client request token')
    }
    if (this.metadata.VersionIdsToStages[this.ClientRequestToken].indexOf(AWSCURRENT) > -1) {
      console.log(JSON.stringify({ fn: 'validateVersionStage', info: 'already current' }))
      return false
    } else if (this.metadata.VersionIdsToStages[this.ClientRequestToken].indexOf(AWSPENDING) === -1) {
      throw new Error('token is not pending')
    }
    return true
  }
  // here we are making sure that the secret version with AWSPENDING
  // stage has a value. it's possible that there's no secret version
  // with AWSPENDING stage, but IT IS ALSO POSSIBLE that there is a
  // version with AWSPENDING stage, but it has NO VALUE. this threw me
  // for while because i didn't realize that a secret can have a
  // version that doesn't have a value.
  async createSecret() {
    console.log(JSON.stringify({ fn: 'createSecret' }))
    // i think here we are just making sure the secret exists at all.
    // if not this will throw an error. is it possible to have a
    // secret w/o an AWSCURRENT stage?
    await sm.getSecretValue({
      SecretId: this.SecretId,
      VersionStage: AWSCURRENT
    }).promise()
    console.log(JSON.stringify({ fn: 'createSecret', info: 'AWSCURRENT exists' }))
    try {
      // now we are checking if the AWSPENDING stage has a value.
      await sm.getSecretValue({
        SecretId: this.SecretId,
        VersionId: this.ClientRequestToken,
        VersionStage: AWSPENDING
      }).promise()
      console.log(JSON.stringify({ fn: 'createSecret', info: 'AWSPENDING already has a value' }))
    } catch (error) {
      if (`${error}`.includes('ResourceNotFound')) {
        const pwdata = await sm.getRandomPassword({ ExcludePunctuation: true }).promise()
        const params = {
          SecretId: this.SecretId,
          ClientRequestToken: this.ClientRequestToken,
          SecretString: pwdata.RandomPassword,
          VersionStages: [AWSPENDING],
        }
        await sm.putSecretValue(params).promise()
        console.log(JSON.stringify({ fn: 'createSecret', info: 'value set for AWSPENDING' }))
      } else {
        throw error
      }
    }
  }
  // Sets the AWSPENDING secret in the service that the secret belongs
  // to. For example, if the secret is a database credential, this
  // method should take the value of the AWSPENDING secret and set the
  // user's password to this value in the database.
  async setSecret() {
    console.log(JSON.stringify({ fn: 'setSecret', error: 'NOT YET IMPLEMENTED' }))
  }
  // Validates that the AWSPENDING secret works in the service that
  // the secret belongs to. For example, if the secret is a database
  // credential, this method should validate that the user can login
  // with the password in AWSPENDING and that the user has all of the
  // expected permissions against the database.
  async testSecret() {
    console.log(JSON.stringify({ fn: 'testSecret', error: 'NOT YET IMPLEMENTED' }))
  }
  // Finalizes the rotation process by marking the secret version
  // passed in as the AWSCURRENT secret.
  async finishSecret() {
    console.log(JSON.stringify({ fn: 'finishSecret' }))
    // const metadata = await sm.describeSecret({ SecretId: this.SecretId }).promise()
    let currentVersion
    for (const [vid, stages] of Object.entries(this.metadata.VersionIdsToStages)) {
      if (stages.indexOf(AWSCURRENT) > -1) {
        if (vid === this.ClientRequestToken) {
          console.log(JSON.stringify({ fn: 'finishSecret', info: 'version already current' }))
          return
        }
        currentVersion = vid
        break
      }
    }
    const params = {
      SecretId: this.SecretId,
      VersionStage: AWSCURRENT,
      MoveToVersionId: this.ClientRequestToken,
      RemoveFromVersionId: currentVersion,
    }
    console.log(JSON.stringify({ fn: 'finishSecret', params }))
    await sm.updateSecretVersionStage(params).promise()
    console.log(JSON.stringify({ fn: 'finishSecret', info: 'success' }))
  }
  async rotate() {
    const keepGoing = await this.validateVersionStage()
    if (!keepGoing) {
      return
    }
    // secrets manager will call this lambda once for each step in order
    // create, set, test, finish, on each rotation.
    await this[this.Step]()
  }
}
const handler = async (event) => {
  await new Rotator(event).rotate()
}
exports = module.exports = {
  handler,
  Rotator,
}
