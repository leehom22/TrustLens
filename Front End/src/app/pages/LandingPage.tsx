import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <div>
      <p>Landing Page</p>
      <button className='bg-white text-black p-2 px-4 rounded-lg'>
        <Link to={'/login'}>Login</Link>
      </button>
    </div>
  )
}

export default LandingPage