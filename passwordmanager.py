import mysql.connector
from cryptography.fernet import Fernet
import random
import os
from words import words

key = Fernet.generate_key()

# Instance the Fernet class with the key
fernet = Fernet(key)

""" MySQL connection """
mydb = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="pswmanager"
)

mycursor = mydb.cursor()

""" Password Generator """


def PasswordGenerator():
    counter = 0
    password = ""
    while counter < 8:
        word = random.choice(words)
        password += word
        counter += 1

    command = 'echo ' + password.strip() + '| clip'
    os.system(command)

    print("\n")

    print("Your generated password is: " + password)
    print("It has been added to the clipboard!")

    print("\n")


""" Add data to database """


def addDataToDatabase():
    print("\n")
    webname = input("Enter name of website: ")
    url = input("Enter url of website: ")
    password = input("Enter password: ")

    # then use the Fernet class instance
    # to encrypt the string string must
    # be encoded to byte string before encryption
    encPassword = fernet.encrypt(password.encode())
    # decPassword = fernet.decrypt(encPassword).decode()

    sql = "INSERT INTO password (webname, url, password) VALUES (%s, %s, %s)"
    val = (webname, url, encPassword)
    mycursor.execute(sql, val)

    mydb.commit()

    print(mycursor.rowcount, "record inserted.")

    print("\n")


""" Show Password """
def showPassword(id):
    mycursor.execute(f"SELECT password FROM password WHERE id LIKE '{id}'")

    myresult = mycursor.fetchone()
    
    for x in myresult:
        print(fernet.decrypt(x).decode())

""" Password Search """


def passwordSearch():
    dataCouner = 0
    id = ""
    webname = ""
    url = ""
    password = ""

    search = input("Enter website name to the for the password: ")
    mycursor.execute(f"SELECT * FROM password WHERE webname LIKE '{search}'")

    myresult = mycursor.fetchone()

    print("\n")
    for x in myresult:
        dataCouner += 1
        if dataCouner == 1:
            id = x
            print("ID:       " + str(x))
        elif dataCouner == 2:
            webname = x
            print("Webname:  " + str(x))
        elif dataCouner == 3:
            url = x
            print("URL:      " + str(x))
        elif dataCouner == 4:
            password = x
            print("Password: " + str(x))

    print("\n")

    print(('-'*13) + 'What do you want to do with password' + ('-' * 13))
    print("1. EDIT DATA")
    print("2. DELETE DATA")
    print("3. SHOW PASSWORD")
    print("4. NOTHING")
    print('-'*30)

    choice = int(input(": "))

    if choice == 1:
        editData(id)
    elif choice == 2:
        deleteData(id)
    elif choice == 3:
        showPassword(id);


def editData(id):
    print("\n")
    webname = input("Enter name of website: ")
    url = input("Enter url of website: ")
    password = input("Enter password: ")

    sql = f"UPDATE password SET webname = '{webname}', url = '{url}', password = '{password}' WHERE id = '{id}'"
    mycursor.execute(sql)

    mydb.commit()

    print(mycursor.rowcount, "record inserted.")
    print("\n")


def deleteData(id):
    sql = f"DELETE FROM password WHERE id = '{id}'"
    mycursor.execute(sql)

    mydb.commit()

    print(mycursor.rowcount, "record(s) deleted")
    print("\n")


""" Menu """


def menu():
    print(('-'*13) + 'Menu' + ('-' * 13))
    print("1. SEARCH FOR PASSWORD OF A WEB PAGE")
    print("2. ADD NEW PASSWORD")
    print("3. GENERATE NEW PASSWORD")
    print("4. EXIT")
    print('-'*30)


""" Main """
done = False

while not done:
    menu()

    choice = int(input(": "))

    if choice == 1:
        passwordSearch()
    elif choice == 2:
        addDataToDatabase()
    elif choice == 3:
        PasswordGenerator()
    elif choice == 4:
        break
