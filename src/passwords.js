const bcrypt=require('bcryptjs');
module.exports={hash:password=>bcrypt.hash(password,12),verify:async(password,stored)=>/^\$2[aby]\$/.test(stored||'')?bcrypt.compare(password,stored):password===stored};
