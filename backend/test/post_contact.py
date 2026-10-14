import requests

url = 'http://localhost:5000/api/v1/contacts'
myobj = {
    'username': 'gueney',
    'password': 'ichliebumayundserdil',
    'email': 'looser_lauch@hotmail.com'
        }

x = requests.post(url, json = myobj)

print(x.text)
