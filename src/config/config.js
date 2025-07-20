const path = require('path');
const {app} = require('electron');

let envObj = null;
try { envObj = require('../env') } catch (err) {}
if (!app.isPackaged) {
    envObj = process.env;
}

const isChitkara = (envObj.CHITKARA
    && (
        (typeof envObj.CHITKARA === 'string' && envObj.CHITKARA.trim() === 'true' )
        || (typeof envObj.CHITKARA === 'boolean' && envObj.CHITKARA === true )
    )
)

const config = ((env) => {
    switch(env) {
        case 'production':  {
            if (isChitkara) {
                return {
                    'URL': 'https://exam.testpad.chitkara.edu.in',
                    'QUIZ_SERVER': 'https://assess.testpad.chitkara.edu.in',
                    'LOGIN_SERVER': 'https://login.testpad.chitkara.edu.in',
                    'allowedUrl': [
                        'https://assess.testpad.chitkara.edu.in', 'https://exam.testpad.chitkara.edu.in',
                        'https://assess.testpad.chitkarauniversity.edu.in', 'https://exam.testpad.chitkarauniversity.edu.in',
                    ],
                    'QUIZ_STATIC': 'https://static.assess.testpad.chitkara.edu.in',
                    'cookieConfig': {
                        'domain': '.testpad.chitkara.edu.in',
                        'httpOnly': true,
                        'path': '/',
                        'sameSite': 'lax',
                        'url': 'https://assess.testpad.chitkara.edu.in',
                    }
                }
            }
            return {
                'URL': 'https://tests.codequotient.com',
                'QUIZ_SERVER': 'https://codequotient.com',
                'LOGIN_SERVER': 'https://login.codequotient.com',
                'allowedUrl': ['https://tests.codequotient.com', 'https://codequotient.com'],
                'QUIZ_STATIC': 'https://static.test.codequotient.com',
                'cookieConfig': {
                    'domain': '.codequotient.com',
                    'httpOnly': true,
                    'path': '/',
                    'sameSite': 'lax',
                    'url': 'https://codequotient.com',
                },
            }   
        }
        case 'testing': {
            return {
                'URL': 'https://tests.cqtestga.com',
                'QUIZ_SERVER': 'https://cqtestga.com',
                'LOGIN_SERVER': 'https://login.cqtestga.com',
                'allowedUrl': ['https://tests.cqtestga.com', 'https://cqtestga.com'],
                'QUIZ_STATIC': 'https://static.cqtestga.com',
                'cookieConfig': {
                    'domain': '.cqtestga.com',
                    'httpOnly': true,
                    'path': '/',
                    'sameSite': 'lax',
                    'url': 'https://cqtestga.com',
                },
            }
        }
        default : return {
            'URL': 'https://test.cqtestga.com',
            'QUIZ_SERVER': 'https://cqtestga.com',
            'LOGIN_SERVER': 'https://login.cqtestga.com',
            'allowedUrl': ['http://localhost:3000','http://localhost:3003', 'http://localhost:3002','https://tests.cqtestga.com', 'https://cqtestga.com'],
            'QUIZ_STATIC': 'https://static.cqtestga.com',
            'cookieConfig': {
                'domain': '.cqtestga.com',
                'httpOnly': true,
                'path': '/',
                'sameSite': 'lax',
                'url': 'https://cqtestga.com',
            },

        }
    }
})(envObj.NODE_ENV);

config.extraResourcesPath = path.join(__dirname, app.isPackaged?'../../../extra/':'../../extra');
const retryPagePath = 'public/html/retryPage.html'
module.exports = Object.freeze({ ...config, isChitkara, retryPagePath});