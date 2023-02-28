/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation

 * ModusBox
 * Vijaya Kumar Guthi <vijaya.guthi@modusbox.com> (Original Author)
 --------------
 ******/
import React from 'react';
import { Layout, Row, Col, Typography, Card } from 'antd';

import logo from '../../assets/img/mojaloop.png';
const { Header } = Layout;
const { Title } = Typography;

class PlainNavbar extends React.Component {
    render() {
        return (
            <>
                <Header
                    style={{
                        height: '20vh',
                        background: '#293e5d',
                    }}
                >
                    <Card
                        style={{
                            marginTop: '2vh',
                            width: '30vh',
                            height: '15vh',
                            background: '#fff',
                            borderColor: '#293e5d',
                            borderWidth: '1px',
                            borderRadius: '8px',
                        }}
                    >
                        <Row>
                            <Col span={4} />
                            <Col span={16} className='text-center'>
                                <img
                                    alt='Mojaloop'
                                    className='img-fluid'
                                    src={logo}
                                />
                            </Col>
                            <Col span={4} />
                        </Row>
                        <Row>
                            <Col span={24} className='text-center'>
                                <Title level={4} style={{ color: '#293e5d' }}>Testing Toolkit</Title>
                            </Col>
                        </Row>
                    </Card>
                </Header>
            </>
        );
    }
}

export default PlainNavbar;
