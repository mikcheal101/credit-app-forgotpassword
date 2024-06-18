import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"


class Validator {

    private body: any = {};
    private valididity: boolean;
    private params: any = {};

    constructor(_body: any) {
        this.body = _body;
        this.valididity = false;
    }

    validate(): void {

        if (!this.body) {

            this.valididity = false;
            throw Error('Username Required!')
        }

        this.params = JSON.parse(this.body);

        if (!this.params.username) {

            this.valididity = false;
            throw Error('Username Required!')
        }

        if (this.params.username.length < 10) {
            this.valididity = false;
            throw Error('Username length must be min 10 chars long!')
        }

        if (!this.params.username.includes('@')) {
            this.valididity = false;
            throw Error('Username must be an email address!')
        }

        this.valididity = true;
    }

    getParameters(): any {
        return this.params;
    }

    isValid(): boolean {
        return this.valididity;
    }

}

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let body = '';
    let statusCode = 200;
    const headers = { 'Content-Type': 'application/json' };

    try {
        // validate input
        // required parts are
        // 1. username - which must also be a valid email address

        let validator: Validator = new Validator(event.body);

        // validate the form
        validator.validate();

        if (validator.isValid()) {
            // fetch the parameters if the validator succeeds
            const params = validator.getParameters();

            /// Query database for user with entered username, whom should have a positive status
            const command = new ScanCommand({
                ProjectionExpression: 'auth_id, username',
                TableName: process.env.TABLE_NAME,
                FilterExpression: 'username = :username AND isActive = :isActive',
                ExpressionAttributeValues: {
                    ':username': params.username,
                    ':isActive': true
                },
                ConsistentRead: true
            })

            const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
            const users = await dynamo.send(command)

            if (users.Items.length === 0) {
                throw Error('Invalid user')
            } else {
                // TODO: revisit the forgotpassword chatter.

                statusCode = 200
                body = `Welcome! ${params.username}`
            }
        }

    } catch (err: any) {
        statusCode = 400
        body = err.message
    }

    const response = {
        statusCode: statusCode,
        body: body,
        headers: headers
    }

    return response
};
