const argon2 = require("argon2");

const Student = require("../models/Student.model");
const User = require("../models/User.model");
const Counter = require("../models/Counter.model");

// =========================
// Helpers
// =========================

function digitsOnly(v){
return String(v || "").replace(/\D/g,"");
}

function normalizePHMobile(input){

const d = digitsOnly(input);

if(d.length===11 && d.startsWith("09")) return "+63"+d.slice(1);
if(d.length===10 && d.startsWith("9")) return "+63"+d;

return d ? "+63"+d : "";
}

async function nextStudentId(){

const counter = await Counter.findOneAndUpdate(
{ key:"studentId"},
{ $inc:{seq:1}},
{ upsert:true, returnDocument:"after"}
);

const n = counter?.seq || 1;

return "STD-"+String(n).padStart(4,"0");

}

function generateTempPassword(){

const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";

let out="";

for(let i=0;i<12;i++)
out+=chars[Math.floor(Math.random()*chars.length)];

return out;

}

// =========================
// Controllers
// =========================

exports.listStudents = async(req,res)=>{

try{

const students = await Student.find({})
.sort({createdAt:-1})
.lean();

res.json({ ok:true, students });

}catch(err){

console.error("listStudents error:",err);

res.status(500).json({
ok:false,
message:"Failed to load students."
});

}

};

exports.createStudent = async(req,res)=>{

let createdUserId=null;

try{

const body=req.body;

const studentId = await nextStudentId();

const tempPass = generateTempPassword();

const passwordHash = await argon2.hash(tempPass);

const username = studentId;

const user = await User.create({

username,
role:"student",
password_hash:passwordHash,
must_change_password:true,
status:"active"

});

createdUserId=user._id;

const studentDoc = {

studentId,

userId:user._id,

firstName:body.firstName,
middleName:body.middleName,
lastName:body.lastName,

gender:body.gender,
dob:body.dob,

lrn:body.lrn,

className:body.className,
sectionName:body.sectionName,

phone:normalizePHMobile(body.phone),
email:body.email || "",

address:body.address || {},

parents:body.parents || {},

photoDataUrl:body.photoDataUrl || "",

isActive:true

};

const student = await Student.create(studentDoc);

res.status(201).json({

ok:true,
student,
tempPass

});

}catch(err){

console.error("createStudent error:",err);

if(createdUserId){

try{

await User.deleteOne({_id:createdUserId});

}catch{}

}

res.status(500).json({

ok:false,
message:"Failed to create student."

});

}

};

exports.deleteStudent = async(req,res)=>{

try{

const { studentId } = req.params;

const student = await Student.findOne({ studentId });

if(!student)
return res.status(404).json({ ok:false, message:"Student not found" });

if(student.userId){

await User.deleteOne({_id:student.userId});

}

await Student.deleteOne({ studentId });

res.json({ ok:true });

}catch(err){

console.error("deleteStudent error:",err);

res.status(500).json({
ok:false,
message:"Failed to delete student"
});

}

};