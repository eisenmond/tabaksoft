import requests

url = 'http://localhost:5000/api/v1/projects'
myobj = {

    'projectname' : 'sie',
    'password' : 'ghail',
    'email' : 'e@mailu.fun',

}

x = requests.post(url, json = myobj)

print(x.text)
