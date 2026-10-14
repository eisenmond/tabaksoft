myobj = {
    'username': 'gueney',
    'password': 'ichliebumayundserdil',
    'email': 'looser_lauch@hotmail.com',
    'projects': [],
    'j'
        }

x = requests.post(url, json = myobj)

print(x.text)

