const {signup, users} = require('../App')

describe('Test - Signup', function () {
    beforeEach(function () {
      users.length = 0; // Clear in-memory users before each test
    });
    const user = {body:{fullname: 'David', email: 'test@mail.com', phone:'6477092671' , address: 'admin', province: 'Quebec', password: '123456', confirmPassword:'123456'}}
    it('should create a new user successfully', function () {
      const result = signup(user);
      expect(result).toEqual({fullname: 'David', email: 'test@mail.com', phone:'6477092671' , address: 'admin', province: 'Quebec', password: '123456', confirmPassword:'123456' });
      expect(users.length).toBe(1);
      expect(users[0].password).toBe('123456'); //  password check
    });
    
    // it('should throw an error if user already exists', function () {
    //   signup(user);
    //   expect(function () {
    //     signup(user);
    //   }).toThrowError('User already exists');
    // });
   
   });
