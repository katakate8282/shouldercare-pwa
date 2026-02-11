import NextAuth from "next-auth"
import KakaoProvider from "next-auth/providers/kakao"
import { supabase } from "@/lib/supabase/client"

const handler = NextAuth({
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "kakao" && user.email) {
        // Supabase에 사용자 저장
        const { data, error } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            name: user.name,
            email: user.email,
          })
          .select()
        
        if (error) {
          console.error('Supabase error:', error)
        }
      }
      return true
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})

export { handler as GET, handler as POST }
