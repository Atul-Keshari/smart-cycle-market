import { isValidObjectId } from 'mongoose';
import { sendErrorRes } from './../utils/helper';
import { RequestHandler } from 'express';
import UserModel from 'src/models/user';
import crypto from 'crypto';
import AuthVerificationTokenModel from 'src/models/authVerificationToken';
import jwt from 'jsonwebtoken';
import mail from 'src/utils/mail';
import PasswordResetTokenModel from 'src/models/passwordResetToken';
import cloudUploader from 'src/cloud';

const VERIFICATION_LINK = process.env.VERIFICATION_LINK;
const JWT_SECRET = process.env.JWT_SECRET!;
const PASSWORD_RESET_LINK = process.env.PASSWORD_RESET_LINK;

export const CreateNewUser: RequestHandler = async (req, res, next)=>{



    const {email,password,name}=req.body;
    
    if(!name) return sendErrorRes(res, "Name is missing!", 422)
    if(!email) return sendErrorRes(res, "Email is missing!", 422)
    if(!password) return sendErrorRes(res, "Password is missing!", 422)

    const existingUser = await UserModel.findOne({email})

    if (existingUser) return sendErrorRes(res, "Unauthorized request, email is already in use!", 401)

    const user = await UserModel.create({
        email,
        password,
        name
    });

    const token = crypto.randomBytes(36).toString('hex');

    await AuthVerificationTokenModel.create({owner: user._id,token})

    const link = `${process.env.VERIFICATION_LINK}?id=${user._id}&token=${token}`

    await mail.sendVerification(user.email,link)

    res.json({message: "Please check your inbox."});
};

export const verifyEmail : RequestHandler = async (req, res) => {
    const {id, token} = req.body;
    
    const authToken = await AuthVerificationTokenModel.findOne({owner: id})
    if(!authToken)return sendErrorRes(res, "Unauthorized request!", 403)

    const isMatched = await authToken.compareToken(token)

    if(!isMatched)return sendErrorRes(res, "Unauthorized request, invalid token!", 403)
    await UserModel.findByIdAndUpdate(id, {verified: true})

    await AuthVerificationTokenModel.findByIdAndDelete(authToken._id)

    res.json({message: "Thanks for joining us, your email is verified."})
}

export const generateVerificationLink : RequestHandler = async (req, res) => {
    const {id} = req.user;
    const token = crypto.randomBytes(36).toString("hex");
    const link = `${VERIFICATION_LINK}?id=${id}&token=${token}`;

    await AuthVerificationTokenModel.findOneAndDelete({owner: id});
    await AuthVerificationTokenModel.create({owner: id,token})

    await mail.sendVerification(req.user.email,link)

    res.json({message: "Please check your inbox."})

}

export const signIn : RequestHandler = async (req, res) => {
    const {email, password} = req.body;

    const user = await UserModel.findOne({email})
    if(!user) return sendErrorRes(res, "Email/Password mismatch!", 403);
    
    const isMatched =  await user.comparePassword(password)
    if(!isMatched) return sendErrorRes(res, "Email/Password mismatch!", 403);

    const payload = {
        id: user._id,
    }
    const accessToken = jwt.sign(payload, JWT_SECRET, {expiresIn: "15m"})
    const refreshToken = jwt.sign(payload, JWT_SECRET)

    if(!user.tokens) user.tokens = [refreshToken]
    else user.tokens.push(refreshToken)

    await user.save()

    res.json({
      profile: {
        id: user._id,
        email: user.email,
        name: user.name,
        verified: user.verified,
        avatar:user.avatar?.url,
      },
      tokens: {
        refresh: refreshToken,
        access: accessToken,
      }
    })
}

export const sendProfile : RequestHandler = async (req, res) => {
  res.json({
    profile: req.user
  })
}

export const grantAccessToken : RequestHandler = async (req, res) => {

  const {refreshToken} = req.body;

  if(!refreshToken) return sendErrorRes(res, "Unauthorized request!", 403);

  const payload = jwt.verify(refreshToken, JWT_SECRET) as {id:string}
  if(!payload.id){
    return sendErrorRes(res, "Unauthorized request!", 401)
  }
  const user = await UserModel.findOne({
    _id:payload.id,
    tokens: refreshToken
  })

  if(!user){
    await UserModel.findByIdAndUpdate(payload.id,{
      tokens:[]
    })
    return sendErrorRes(res, "Unauthorized request!", 401);
  }

  const newAccessToken = jwt.sign({ id: user._id }, JWT_SECRET, {
    expiresIn: "15m",
  });

  const newRefreshToken = jwt.sign({ id: user._id }, JWT_SECRET);

  const filteredTokens = user.tokens.filter((t)=>t!==refreshToken)

  user.tokens = filteredTokens
  user.tokens.push(newRefreshToken)
  await user.save()

  res.json({
    profile: {
      id: user._id,
      email: user.email,
      name: user.name,
      verified: user.verified,
      avatar: user.avatar?.url,
    },
    tokens: { refresh: newRefreshToken, access: newAccessToken },
  });

}

export const signOut : RequestHandler = async (req, res) => {

  const {refreshToken} = req.body;
  const user = await UserModel.findOne({_id:req.user.id,tokens:req.body.refreshToken})

  if(!user) return sendErrorRes(res, "Unauthorized request, user not found!", 403);

  const newTokens = user.tokens.filter((t)=>t!==refreshToken)

  user.tokens = newTokens;

  await user.save();

  res.send();

}

export const generateForgetPassLink : RequestHandler = async (req, res) => {

  const {email} = req.body;
  const user = await UserModel.findOne({email})

  if(!user) return sendErrorRes(res, "Account not found!", 404);

  await PasswordResetTokenModel.findOneAndDelete({owner:user._id})

  const token = crypto.randomBytes(36).toString("hex");
  await PasswordResetTokenModel.create({owner:user._id,token})

  const passResetLink = `${PASSWORD_RESET_LINK}?id=${user._id}&token=${token}`

  await mail.sendPasswordResetLink(user.email, passResetLink);

  res.json({message: "Please check your email."})

}

export const grantValid : RequestHandler = async (req, res) => {

  res.json({valid:true});

}

export const updatePassword : RequestHandler = async (req, res) => {

  const {id,password} = req.body;

  const user = await UserModel.findById(id);

  if(!user) return sendErrorRes(res, "Unauthorized access!", 403);

  const matched = await user.comparePassword(password);
  
  if(matched) return sendErrorRes(res, "The new password must be different!", 422);

  user.password = password;

  await user.save();

  await PasswordResetTokenModel.findOneAndDelete({owner:user._id});

  await mail.sendPasswordUpdateMessage(user.email);

  res.json({message: "Password reset successfully!"})

}

export const updateProfile : RequestHandler = async (req, res) => {

  const {name} = req.body;

  if(typeof name !== 'string' || name.trim().length <3) return sendErrorRes(res, "Invalid name!", 422);

  await UserModel.findByIdAndUpdate(req.user.id,{name});

  res.json({profile: {...req.user, name}})

}

export const updateAvatar: RequestHandler = async (req, res) => {
  
  const {avatar} = req.files;

  if(Array.isArray(avatar)) return sendErrorRes(res, "Multiple files are not allowed!", 422);

  if(!avatar.mimetype?.startsWith("image")){
    return sendErrorRes(res, "Invalid image file!", 422);
  }

  const user = await UserModel.findById(req.user.id)

  if(!user) return sendErrorRes(res, "User not found!", 404);

  if(user.avatar?.id){
    await cloudUploader.destroy(user.avatar.id);
  }

  const {secure_url:url, public_id:id} = await cloudUploader.upload(avatar.filepath,{
    width:300,
    height:300,
    crop:"thumb",
    gravity:"face"
  })

  user.avatar = {url, id};

  await user.save();

  res.json({profile:{...req.user, avatar:user.avatar.url}})
};

export const sendPublicProfile: RequestHandler = async (req, res) => {
  
 const profileId = req.params.id

 if(!isValidObjectId(profileId)){
  return sendErrorRes(res, "Invalid profile id!", 422)
 }

 const user = await UserModel.findById(profileId);

 if(!user) return sendErrorRes(res, "Profile not found!", 404);

 res.json({profile: {id:user._id,name:user.name,avatar:user.avatar?.url}})

};