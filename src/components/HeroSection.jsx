import React, { useEffect, useState } from 'react'
import styles from './HeroSection.module.css'
import StaffDashboard from './StaffDashboard'

const php = (value) => `₱${value.toFixed(2)}`
const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// Legacy USD prices use the 2026-10-22 rate of PHP 63.509 per USD.
const menuData = {
  Signature: [
    { id: 101, name: "S'mores Latte Special · 8oz", price: 180, priceDisplay: php(180), currency: 'PHP', description: 'Espresso and steamed milk with toasted marshmallow and chocolate, finished with a graham-cracker crumble.', image: "/S' mores Latte Special.png", soldOut: true },
    { id: 102, name: "S'mores Latte Special · 12oz", price: 220, priceDisplay: php(220), currency: 'PHP', description: 'Espresso and steamed milk with toasted marshmallow and chocolate, finished with a graham-cracker crumble.', image: "/S' mores Latte Special.png", soldOut: true },
    { id: 103, name: 'Salted Caramel Silk Creame · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'Smooth espresso and milk layered with buttery salted caramel and a soft cream finish.', image: '/Salted Caramel Silk Creame.png' },
    { id: 104, name: 'Salted Caramel Silk Creame · 16oz', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'Smooth espresso and milk layered with buttery salted caramel and a soft cream finish.', image: '/Salted Caramel Silk Creame.png' },
    { id: 105, name: 'Honey Cinnamon Cloud · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'A mellow espresso latte sweetened with honey and topped with fragrant cinnamon foam.', image: '/Honey Cinnamon Cloud.png' },
    { id: 106, name: 'Honey Cinnamon Cloud · 16oz', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'A mellow espresso latte sweetened with honey and topped with fragrant cinnamon foam.', image: '/Honey Cinnamon Cloud.png' },
    { id: 107, name: 'Brume Latte · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'A gentle, velvety espresso latte with a creamy finish and a delicate dusting of cocoa.', image: '/Brume Latte.png' },
    { id: 108, name: 'Brume Latte · 16oz', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'A gentle, velvety espresso latte with a creamy finish and a delicate dusting of cocoa.', image: '/Brume Latte.png' },
    { id: 109, name: 'Hot Cocoa Cream Mocha · 8oz', price: 180, priceDisplay: php(180), currency: 'PHP', description: 'Rich cocoa and espresso blended with steamed milk and a smooth cream topping.', image: '/Hot Cocoa Cream Mocha.png', soldOut: true },
    { id: 110, name: 'Hot Cocoa Cream Mocha · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'Rich cocoa and espresso blended with steamed milk and a smooth cream topping.', image: '/Hot Cocoa Cream Mocha.png', soldOut: true },
    { id: 111, name: 'Iced Cocoa Cream Mocha · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'Chilled espresso and cocoa over ice, finished with a cool, creamy topping.', image: '/Iced Cocoa Cream Mocha.png', soldOut: true },
    { id: 112, name: 'Iced Cocoa Cream Mocha · 16oz', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'Chilled espresso and cocoa over ice, finished with a cool, creamy topping.', image: '/Iced Cocoa Cream Mocha.png', soldOut: true },
    { id: 113, name: 'Hot Barista Signature Artisan Latte · 8oz', price: 180, priceDisplay: php(180), currency: 'PHP', description: 'A carefully pulled espresso with silky steamed milk and handcrafted latte art.', image: '/Hot Barista Signature Artisan Latte.png' },
    { id: 114, name: 'Hot Barista Signature Artisan Latte · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'A carefully pulled espresso with silky steamed milk and handcrafted latte art.', image: '/Hot Barista Signature Artisan Latte.png' },
    { id: 115, name: 'Hot Barista Signature Artisan Latte · 16oz', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'A carefully pulled espresso with silky steamed milk and handcrafted latte art.', image: '/Hot Barista Signature Artisan Latte.png' },
    { id: 116, name: 'Iced Barista Signature Artisan Latte · 12oz', price: 220, priceDisplay: php(220), currency: 'PHP', description: 'A chilled artisan espresso latte over ice with a smooth, creamy finish.', image: '/Hot Barista Signature Artisan Latte.png' },
    { id: 117, name: 'Iced Barista Signature Artisan Latte · 16oz', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'A chilled artisan espresso latte over ice with a smooth, creamy finish.', image: '/Hot Barista Signature Artisan Latte.png' },
    { id: 1, name: 'Pour-Over', price: 285.79, priceDisplay: php(285.79), currency: 'PHP', description: 'Slow-dripped perfection with floral notes.', image: '/Pour-over Coffee.png' },
    { id: 2, name: 'French Press', price: 269.91, priceDisplay: php(269.91), currency: 'PHP', description: 'Full-bodied and rich with robust flavor.', image: '/French Press.png' },
    { id: 3, name: 'Espresso', price: 238.16, priceDisplay: php(238.16), currency: 'PHP', description: 'Concentrated shot of bold, intense coffee.', image: '/Espresso.png' },
    { id: 4, name: 'Crema Coffee', price: 333.42, priceDisplay: php(333.42), currency: 'PHP', description: 'Velvety smooth with a luxurious crema.', image: '/Crema Coffee.png' }
  ],
  Starter: [
    { id: 201, name: 'Mozarella Sticks', price: 230, priceDisplay: php(230), currency: 'PHP', description: 'Golden, crunchy mozzarella sticks served with a tangy tomato dipping sauce.', image: '/Mozarella Sticks.png', soldOut: true },
    { id: 202, name: 'Salad & Fries', price: 250, priceDisplay: php(250), currency: 'PHP', description: 'A fresh garden salad paired with a generous side of crisp, seasoned fries.', image: '/Salad & Fries.png', soldOut: true },
    { id: 203, name: 'Salted Chicken Wings', price: 265, priceDisplay: php(265), currency: 'PHP', description: 'Juicy chicken wings seasoned with a savory salt blend and cooked until golden.', image: '/Salted Chicken Wings.png' },
    { id: 204, name: 'Beef Nachos', price: 265, priceDisplay: php(265), currency: 'PHP', description: 'Crisp tortilla chips piled with seasoned beef, melted cheese, and flavorful toppings.', image: '/Beef Nachos.png' },
    { id: 205, name: 'YTD Fries', price: 250, priceDisplay: php(250), currency: 'PHP', description: 'A hearty plate of loaded fries topped with savory sauces and flavorful bites.', image: '/YTD Fries.png' },
    { id: 206, name: 'Salted Fries', price: 150, priceDisplay: php(150), currency: 'PHP', description: 'Classic golden fries, freshly cooked and lightly seasoned with salt.', image: '/Salted Fries.png' },
    { id: 207, name: 'Loaded Fries', price: 250, priceDisplay: php(250), currency: 'PHP', description: 'Crispy fries finished with savory toppings, melted cheese, and house sauce.', image: '/Loaded Fries.png' },
    { id: 208, name: 'Beef Quesadilla Platter', price: 230, priceDisplay: php(230), currency: 'PHP', description: 'Toasted quesadilla wedges filled with seasoned beef and melted cheese, served with dip.', image: '/Cheese Quesadilla.png' },
    { id: 5, name: 'Vanilla Milkshake', price: 412.81, priceDisplay: php(412.81), currency: 'PHP', description: 'Classic creamy vanilla indulgence.', image: '/Vanilla Milkshake.png' },
    { id: 6, name: 'Oreo Milkshake', price: 460.44, priceDisplay: php(460.44), currency: 'PHP', description: 'Blended with crushed Oreos and vanilla ice cream.', image: '/Oreo Milkshake.png' },
    { id: 7, name: 'Strawberry Milkshake', price: 428.69, priceDisplay: php(428.69), currency: 'PHP', description: 'Fresh strawberry flavor with whipped cream.', image: '/Strawberry Milkshake.png' },
    { id: 8, name: 'Chocolate Milkshake', price: 444.56, priceDisplay: php(444.56), currency: 'PHP', description: 'Rich chocolate delight topped with cream.', image: '/Chocolate Milkshake.png' }
  ],
  Espresso: [
    { id: 301, name: 'Classic Espresso Tonic', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'A bright espresso shot poured over sparkling tonic with a refreshing citrus lift.', image: '/Classic Espresso Tonic.png' },
    { id: 302, name: 'Agave Spark Espresso', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'Bold espresso balanced with mellow agave sweetness and a lively sparkling finish.', image: '/Agave Spark Espresso.png' },
    { id: 303, name: 'Peach Espresso Pop', price: 240, priceDisplay: php(240), currency: 'PHP', description: 'A juicy peach note meets crisp espresso for a bright, fruity coffee refresher.', image: '/Peach Espresso Pop.png' },
    { id: 304, name: 'Honey Lemon Americano · 8oz', price: 180, priceDisplay: php(180), currency: 'PHP', description: 'A smooth Americano lifted with honey sweetness and a touch of fresh lemon.', image: '/Honey Lemon Americano.png' },
    { id: 9, name: 'Sourdough', price: 349.30, priceDisplay: php(349.30), currency: 'PHP', description: 'Artisan sourdough with a crispy crust.', image: '/Sourdough.png' },
    { id: 10, name: 'Baguette', price: 269.91, priceDisplay: php(269.91), currency: 'PHP', description: 'Crispy French baguette, perfect for any meal.', image: '/Baguette.png' },
    { id: 11, name: 'Brioche', price: 381.05, priceDisplay: php(381.05), currency: 'PHP', description: 'Buttery, soft, and slightly sweet brioche.', image: '/Brioche.png' },
    { id: 12, name: 'Ciabatta', price: 333.42, priceDisplay: php(333.42), currency: 'PHP', description: 'Rustic Italian bread with airy texture.', image: '/Ciabatta.png' },
    { id: 13, name: 'Focaccia', price: 365.18, priceDisplay: php(365.18), currency: 'PHP', description: 'Herb-infused focaccia with olive oil.', image: '/Focaccia.png' }
  ]
}

const categories = Object.keys(menuData)
const logo = asset('/grounded-brew-logo.png')
const manilaTimeZone = 'Asia/Manila'

const getManilaParts = (date) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: manilaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map(({ type, value }) => [type, value])
)

const getManilaDate = (offsetDays = 0) => {
  const parts = getManilaParts(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const getScheduleTimes = (date) => {
  const parts = getManilaParts(new Date())
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const earliest = Date.now() + 30 * 60 * 1000
  const times = []
  for (let minutes = 9 * 60; minutes <= 20 * 60 + 30; minutes += 30) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
    const minute = String(minutes % 60).padStart(2, '0')
    const value = `${hour}:${minute}`
    const timestamp = Date.parse(`${date}T${value}:00+08:00`)
    if (date !== today || timestamp >= earliest) {
      const label = new Intl.DateTimeFormat('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila'
      }).format(new Date(timestamp))
      times.push({ value, label })
    }
  }
  return times
}

const getFirstScheduleDate = () => {
  for (let offset = 0; offset <= 14; offset += 1) {
    const date = getManilaDate(offset)
    if (getScheduleTimes(date).length > 0) return date
  }
  return getManilaDate()
}

const formatPHP = (cents) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(cents / 100)
const socialLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/joshua-cerna-446a15403' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@ft.yandool' },
  { label: 'Instagram', href: 'https://www.instagram.com/ft.joswa?exIn=MTZ5czVIY2RsN2Zsda==' },
  { label: 'Facebook', href: 'https://www.facebook.com/ft.joswa' }
]
const cafeAddress = '3 Limaria Building Maa Road, Davao City, Philippines'
const cafeAddressQuery = encodeURIComponent(cafeAddress)
const cafeDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${cafeAddressQuery}`
const cafeMapEmbedUrl = `https://www.google.com/maps?q=${cafeAddressQuery}&output=embed`

const ContactIcon = ({ type }) => {
  const iconPaths = {
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z" />,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[type]}
    </svg>
  )
}

const HeroSection = () => {
  const [activePage, setActivePage] = useState('Home')
  const [activeFeature, setActiveFeature] = useState(categories[0])
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [serviceConfig, setServiceConfig] = useState(null)
  const [serviceConfigError, setServiceConfigError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [deliveryQuote, setDeliveryQuote] = useState(null)
  const [placedOrder, setPlacedOrder] = useState(null)
  const [fulfillment, setFulfillment] = useState('pickup')
  const [scheduleDate, setScheduleDate] = useState(() => getFirstScheduleDate())
  const [scheduleTime, setScheduleTime] = useState(() => getScheduleTimes(getFirstScheduleDate())[0]?.value || '')
  const [contactPhone, setContactPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerOrders, setCustomerOrders] = useState([])
  const [customerOrdersError, setCustomerOrdersError] = useState('')
  const [customerOrdersBusy, setCustomerOrdersBusy] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [pendingItem, setPendingItem] = useState(null)
  const [authUnavailable, setAuthUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not check your sign-in status.')
        return response.json()
      })
      .then(({ user }) => {
        if (active) setAuthUser(user)
      })
      .catch(() => {
        if (active) setAuthUnavailable(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/config')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load checkout settings.')
        if (active) {
          setServiceConfig(result)
          setPaymentMethod(result.paymentMethods[0]?.id || '')
        }
      })
      .catch((error) => {
        if (active) setServiceConfigError(error.message || 'Checkout settings are unavailable.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (activePage !== 'My Orders' || !authUser) return undefined
    let active = true
    setCustomerOrdersBusy(true)
    setCustomerOrdersError('')
    fetch('/api/orders')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load your orders.')
        if (active) setCustomerOrders(result.orders)
      })
      .catch((error) => {
        if (active) setCustomerOrdersError(error.message || 'Could not load your orders.')
      })
      .finally(() => {
        if (active) setCustomerOrdersBusy(false)
      })
    return () => { active = false }
  }, [activePage, authUser])

  useEffect(() => {
    if (!showAuth) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowAuth(false)
        setPendingItem(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showAuth])

  const openAuth = (item = null) => {
    setPendingItem(item)
    setAuthError('')
    setShowPassword(false)
    setShowAuth(true)
  }

  const addToCart = (item) => {
    if (!authUser) {
      openAuth(item)
      return
    }
    setCart((currentCart) => [...currentCart, { ...item, cartId: Date.now() + Math.random() }])
  }

  const removeFromCart = (cartId) => {
    setCart((currentCart) => currentCart.filter((item) => item.cartId !== cartId))
  }

  const cartTotalCents = cart.reduce((total, item) => total + Math.round(item.price * 100), 0)
  const formatCartTotal = () => formatPHP(cartTotalCents)
  const availableScheduleTimes = getScheduleTimes(scheduleDate)
  const maxScheduleDate = getManilaDate(14)
  const updateScheduleDate = (date) => {
    setScheduleDate(date)
    setScheduleTime(getScheduleTimes(date)[0]?.value || '')
  }

  const requestDeliveryQuote = async () => {
    setQuoteBusy(true)
    setCheckoutError('')
    try {
      const response = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: deliveryAddress })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not calculate the delivery fee.')
      setDeliveryQuote(result.quote)
    } catch (error) {
      setDeliveryQuote(null)
      setCheckoutError(error.message || 'Could not calculate the delivery fee.')
    } finally {
      setQuoteBusy(false)
    }
  }

  const handlePlaceOrder = async (event) => {
    event.preventDefault()
    setCheckoutBusy(true)
    setCheckoutError('')
    try {
      const quantities = new Map()
      for (const item of cart) quantities.set(item.id, (quantities.get(item.id) || 0) + 1)
      const items = [...quantities].map(([id, quantity]) => ({ id, quantity }))
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          fulfillment,
          scheduledAt: `${scheduleDate}T${scheduleTime}:00+08:00`,
          contactPhone,
          deliveryAddress,
          deliveryQuoteId: deliveryQuote?.id,
          paymentMethod
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not place your order.')
      setPlacedOrder(result.order)
      setCart([])
      setFulfillment('pickup')
      const nextScheduleDate = getFirstScheduleDate()
      setScheduleDate(nextScheduleDate)
      setScheduleTime(getScheduleTimes(nextScheduleDate)[0]?.value || '')
      setContactPhone('')
      setDeliveryAddress('')
      setPaymentMethod(serviceConfig?.paymentMethods[0]?.id || 'cash')
      setCheckoutError('')
      setDeliveryQuote(null)
    } catch (error) {
      setCheckoutError(error.message || 'Could not place your order.')
    } finally {
      setCheckoutBusy(false)
    }

  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to sign in. Please try again.')
      setAuthUser(result.user)
      setAuthUnavailable(false)
      setShowAuth(false)
      setAuthName('')
      setAuthEmail('')
      setAuthPassword('')
      setShowPassword(false)
      if (pendingItem) {
        setCart((currentCart) => [...currentCart, { ...pendingItem, cartId: Date.now() + Math.random() }])
      }
      setPendingItem(null)
    } catch (error) {
      setAuthError(error.message || 'Account service is unavailable. Please try again later.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Could not sign out.')
      setAuthUser(null)
      setCart([])
      setActivePage('Home')
    } catch (error) {
      setAuthError(error.message || 'Could not sign out. Please try again.')
      setShowAuth(true)
    }
  }

  const openCart = () => {
    if (authUser) {
      setShowCart(true)
      return
    }
    openAuth()
  }

  const renderCatalog = (withOrdering) => (
    <div className={styles.catalog}>
      {categories.map((category) => (
        <section className={styles.catalogCategory} key={category}>
          <h2 className={styles.categoryTitle}>{category}</h2>
          <div className={styles.menuItemsGrid}>
            {menuData[category].map((item) => (
              <article className={styles.menuItem} key={item.id}>
                <button
                  className={styles.itemPreview}
                  onClick={() => addToCart(item)}
                  disabled={item.soldOut}
                  aria-label={`${item.soldOut ? 'Sold out: ' : 'Select '}${item.name}, ${item.priceDisplay}`}
                >
                  <div className={styles.menuItemImage}>
                    <img src={asset(item.image)} alt="" loading="lazy" />
                  </div>
                  <div className={styles.menuItemContent}>
                    <div className={styles.itemHeading}>
                      <h3 className={styles.menuItemName}>{item.name}</h3>
                      <p className={styles.menuItemPrice}>{item.priceDisplay}</p>
                    </div>
                    <p className={styles.menuItemDescription}>{item.description}</p>
                    {item.soldOut && <span className={styles.soldOut}>Currently sold out</span>}
                  </div>
                </button>
                {withOrdering && !item.soldOut && (
                  <button className={styles.addToCartBtn} onClick={() => addToCart(item)}>
                    Add to Order
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <div className={styles.heroContainer}>
      <div className={styles.alertBar}>Freshly brewed at Grounded Brew Café</div>

      <header className={styles.header}>
        <div className={styles.navContainer}>
          <button className={styles.logo} onClick={() => setActivePage('Home')} aria-label="Grounded Brew Café home">
            <img src={logo} alt="" />
            <span>Grounded Brew Café</span>
          </button>
          <nav className={styles.navLinks} aria-label="Main navigation">
            {[
              { label: 'Home', page: 'Home' },
              { label: 'Menu', page: 'Menu' },
              { label: 'Order Online', page: 'Order Online' },
              { label: 'About', page: 'About' },
              { label: 'Contact', page: 'Contact' }
            ].map(({ label, page }) => (
              <button
                key={label}
                className={`${styles.navLink} ${activePage === page ? styles.navLinkActive : ''}`}
                aria-current={activePage === page ? 'page' : undefined}
                onClick={() => setActivePage(page)}
              >
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.navActions}>
            {['admin', 'staff'].includes(authUser?.role) && (
              <button className={styles.accountButton} onClick={() => setActivePage('Staff Dashboard')}>
                Dashboard
              </button>
            )}
            {authUser && (
              <button className={styles.accountButton} onClick={() => setActivePage('My Orders')}>
                My orders
              </button>
            )}
            <button
              className={styles.accountButton}
              onClick={() => authUser ? handleLogout() : openAuth()}
            >
              {authUser ? 'Sign out' : 'Login / Register'}
            </button>
            <button
              className={styles.cart}
              onClick={openCart}
              aria-label={`Open cart, ${cart.length} items`}
            >
              🛒 <span>{formatCartTotal()}</span><span className={styles.cartCount}>{cart.length}</span>
            </button>
          </div>
        </div>
      </header>

      {activePage === 'Home' && (
        <main>
          <section className={styles.homeHero} aria-label="Grounded Brew Café introduction">
            <video className={styles.video} autoPlay loop muted playsInline>
              <source src={asset('/cofe.mp4')} type="video/mp4" />
            </video>
            <div className={styles.overlay} />
          </section>
          <section className={styles.menuSection}>
            <div className={styles.menuContainer}>
              <h2 className={styles.menuTitle}>Our Features</h2>
              <div className={styles.featureTabs}>
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`${styles.featureTab} ${activeFeature === category ? styles.activeTab : ''}`}
                    onClick={() => setActiveFeature(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className={styles.menuItemsGrid}>
                {menuData[activeFeature].map((item) => (
                  <article className={styles.menuItem} key={item.id}>
                    <button
                      className={styles.itemPreview}
                      onClick={() => addToCart(item)}
                      disabled={item.soldOut}
                      aria-label={`${item.soldOut ? 'Sold out: ' : 'Select '}${item.name}, ${item.priceDisplay}`}
                    >
                      <div className={styles.menuItemImage}>
                        <img src={asset(item.image)} alt="" loading="lazy" />
                      </div>
                      <div className={styles.menuItemContent}>
                        <div className={styles.itemHeading}>
                          <h3 className={styles.menuItemName}>{item.name}</h3>
                          <p className={styles.menuItemPrice}>{item.priceDisplay}</p>
                        </div>
                        <p className={styles.menuItemDescription}>{item.description}</p>
                        {item.soldOut && <span className={styles.soldOut}>Currently sold out</span>}
                      </div>
                    </button>
                    {!item.soldOut && (
                      <button className={styles.addToCartBtn} onClick={() => addToCart(item)}>
                        Add to Order
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {activePage === 'Menu' && (
        <main className={styles.catalogPage}>
          <div className={styles.menuContainer}>
            <p className={styles.eyebrow}>Good things, made fresh</p>
            <h1 className={styles.menuTitle}>Our Menu</h1>
            {renderCatalog(true)}
          </div>
        </main>
      )}

      {activePage === 'Order Online' && (
        <main className={styles.catalogPage}>
          <div className={styles.menuContainer}>
            <p className={styles.eyebrow}>Your favorites are a few clicks away</p>
            <h1 className={styles.menuTitle}>Order Online</h1>
            {renderCatalog(true)}
          </div>
        </main>
      )}

      {activePage === 'About' && (
        <main className={styles.catalogPage}>
          <section className={styles.infoPage} aria-labelledby="about-title">
            <p className={styles.eyebrow}>A little about us</p>
            <h1 className={styles.menuTitle} id="about-title">Grounded in good coffee</h1>
            <p className={styles.infoIntro}>
              Grounded Brew Café is all about thoughtfully made coffee, comforting bites, and
              creating a welcoming place to enjoy the moment.
            </p>
            <div className={styles.missionCard}>
              <span className={styles.featureAccent} />
              <h2>Our mission</h2>
              <p>
                We believe a good cup can make an everyday moment feel special. Our mission is
                to serve enjoyable drinks and food with care, bringing people together one
                freshly made order at a time.
              </p>
            </div>
            <button className={styles.infoAction} onClick={() => setActivePage('Menu')}>
              Explore our menu
            </button>
          </section>
        </main>
      )}

      {activePage === 'Contact' && (
        <main className={styles.catalogPage}>
          <section className={styles.infoPage} aria-labelledby="contact-title">
            <p className={styles.eyebrow}>We'd love to hear from you</p>
            <h1 className={styles.menuTitle} id="contact-title">Connect with us</h1>
            <p className={styles.infoIntro}>
              Visit us in Davao City, give us a call, or get in touch online.
            </p>
            <div className={styles.contactLayout}>
              <div className={styles.contactDetails}>
                <a
                  className={styles.contactDetail}
                  href={cafeDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.contactIcon}><ContactIcon type="location" /></span>
                  <span className={styles.contactDetailText}>
                    <strong>Address</strong>
                    <span>{cafeAddress}</span>
                    <span className={styles.contactDetailAction}>Get directions ↗</span>
                  </span>
                </a>
                <a className={styles.contactDetail} href="tel:+63822985820">
                  <span className={styles.contactIcon}><ContactIcon type="phone" /></span>
                  <span className={styles.contactDetailText}>
                    <strong>Number</strong>
                    <span>(082) 298 5820</span>
                  </span>
                </a>
                <a className={styles.contactDetail} href="mailto:groundedbrewcafe@gmail.com">
                  <span className={styles.contactIcon}><ContactIcon type="email" /></span>
                  <span className={styles.contactDetailText}>
                    <strong>Email</strong>
                    <span>groundedbrewcafe@gmail.com</span>
                  </span>
                </a>
                <a
                  className={styles.contactDetail}
                  href="https://www.instagram.com/groundedbrewcafe/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.contactIcon}><ContactIcon type="instagram" /></span>
                  <span className={styles.contactDetailText}>
                    <strong>Instagram</strong>
                    <span>instagram.com/groundedbrewcafe</span>
                  </span>
                </a>
              </div>
              <div className={styles.contactMap}>
                <iframe
                  title="Google Maps location for Grounded Brew Café"
                  src={cafeMapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <a href={cafeDirectionsUrl} target="_blank" rel="noopener noreferrer">
                  Open in Google Maps
                </a>
              </div>
            </div>
            <div className={styles.contactSocials} aria-label="Grounded Brew Café social media">
              {socialLinks.map(({ label, href }) => (
                <a
                  className={styles.contactSocialLink}
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit Grounded Brew Café on ${label} (opens in a new tab)`}
                >
                  <span>{label}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </section>
        </main>
      )}

      {activePage === 'My Orders' && authUser && (
        <main className={styles.catalogPage}>
          <div className={styles.menuContainer}>
            <p className={styles.eyebrow}>Grounded Brew Café</p>
            <h1 className={styles.menuTitle}>My Orders</h1>
            {customerOrdersError && <p className={styles.checkoutError} role="alert">{customerOrdersError}</p>}
            {customerOrdersBusy ? (
              <p className={styles.orderHistoryEmpty}>Loading your orders…</p>
            ) : customerOrders.length === 0 ? (
              <p className={styles.orderHistoryEmpty}>You have not placed an order yet.</p>
            ) : (
              <div className={styles.orderHistoryList}>
                {customerOrders.map((order) => (
                  <article className={styles.orderHistoryCard} key={order.id}>
                    <div className={styles.orderHistoryHeading}>
                      <div>
                        <h2>{order.orderNumber}</h2>
                        <p>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} · {new Intl.DateTimeFormat('en-PH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: manilaTimeZone
                        }).format(new Date(order.scheduledAt))}</p>
                      </div>
                      <strong>{order.status.replaceAll('_', ' ')}</strong>
                    </div>
                    <ul>
                      {order.items.map((item) => (
                        <li key={item.id}>{item.quantity} × {item.name} <span>{formatPHP(item.lineTotalCents)}</span></li>
                      ))}
                    </ul>
                    <p className={styles.orderHistoryTotal}>Total: {formatPHP(order.totalCents)} · Payment: {order.paymentMethod === 'gcash' ? 'GCash online transfer' : 'Cash'} ({order.paymentStatus})</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {activePage === 'Staff Dashboard' && ['admin', 'staff'].includes(authUser?.role) && (
        <StaffDashboard user={authUser} />
      )}

      <footer className={styles.siteFooter}>
        <div className={styles.footerBanner}>
          <div className={styles.footerBannerContent}>
            <h2>Stay connected with Grounded Brew Café</h2>
            <p>Follow along for fresh brews, menu updates, and more.</p>
          </div>
        </div>
        <div className={styles.footerMain}>
          <button className={styles.footerBrand} onClick={() => setActivePage('Home')}>
            <img src={logo} alt="" />
            <span>Grounded Brew Café</span>
          </button>
          <div className={styles.footerSocials} aria-label="Social media">
            {socialLinks.map(({ label, href }) => (
              <a
                className={styles.socialLink}
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit Grounded Brew Café on ${label} (opens in a new tab)`}
              >
                {label}
              </a>
            ))}
          </div>
          <p className={styles.footerCopyright}>© {new Date().getFullYear()} Grounded Brew Café</p>
        </div>
      </footer>

      {showAuth && (
        <div className={styles.authOverlay} onClick={() => { setShowAuth(false); setPendingItem(null) }}>
          <section
            className={styles.authPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onClick={(event) => event.stopPropagation()}
          >
            <video className={styles.authVideo} autoPlay loop muted playsInline aria-hidden="true">
              <source src={asset('/login.mp4')} type="video/mp4" />
            </video>
            <div className={styles.authScrim} />
            <div className={styles.authContent}>
              <button
                className={styles.authClose}
                onClick={() => { setShowAuth(false); setPendingItem(null) }}
                aria-label="Close login"
              >
                ×
              </button>
              <img className={styles.authLogo} src={logo} alt="Grounded Brew Café" />
              <h2 id="auth-title">{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
              <p className={styles.authIntro}>
                We're glad you're here—let's make your next coffee moment a good one.
              </p>
              <div className={styles.authModes} role="tablist" aria-label="Account options">
                {['login', 'register'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={authMode === mode}
                    className={`${styles.authMode} ${authMode === mode ? styles.authModeActive : ''}`}
                    onClick={() => {
                      setAuthMode(mode)
                      setAuthError('')
                      setShowPassword(false)
                    }}
                  >
                    {mode === 'login' ? 'Login' : 'Register'}
                  </button>
                ))}
              </div>
              <form className={styles.authForm} onSubmit={handleAuthSubmit}>
                {authMode === 'register' && (
                  <p className={styles.authHint}>
                    No email will be sent or confirmed. Use any email-shaped address you can remember for signing in.
                  </p>
                )}
                {authMode === 'register' && (
                  <label className={styles.authLabel}>
                    Name
                    <input
                      className={styles.authInput}
                      type="text"
                      autoComplete="name"
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>
                )}
                <label className={styles.authLabel}>
                  Email
                  <input
                    className={styles.authInput}
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    maxLength={254}
                    required
                  />
                </label>
                <label className={styles.authLabel}>
                  Password
                  <span className={styles.passwordField}>
                    <input
                      className={`${styles.authInput} ${styles.passwordInput}`}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <button
                      className={styles.passwordToggle}
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                          <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.1 9.5 7a10.8 10.8 0 01-3 4.4M6.2 6.2A11.3 11.3 0 002.5 12c1 2.9 4.5 7 9.5 7 1.2 0 2.3-.2 3.3-.6" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </span>
                  {authMode === 'register' && <span className={styles.authHint}>Use at least 8 characters.</span>}
                </label>
                {(authError || authUnavailable) && (
                  <p className={styles.authError} role="alert">
                    {authError || 'Account service is unavailable. Please try again later.'}
                  </p>
                )}
                <button
                  className={styles.authSubmit}
                  type="submit"
                  disabled={authBusy}
                >
                  {authBusy
                    ? 'Please wait…'
                    : authMode === 'login'
                      ? 'Login'
                      : 'Confirm registration'}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {showCart && (
        <div className={styles.cartOverlay} onClick={() => setShowCart(false)}>
          <section className={styles.cartPanel} role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.cartHeader}>
              <h2 className={styles.cartTitle} id="cart-title">Your Order</h2>
              {authUser && (
                <button
                  className={styles.cartHistoryButton}
                  onClick={() => { setShowCart(false); setActivePage('My Orders') }}
                >
                  My orders
                </button>
              )}
              <button className={styles.cartClose} onClick={() => setShowCart(false)} aria-label="Close cart">×</button>
            </div>
            <div className={styles.cartItems}>
              {cart.length === 0 ? (
                <p className={styles.cartEmpty}>Your cart is empty. Browse Order Online to add something delicious.</p>
              ) : cart.map((item) => (
                <div key={item.cartId} className={styles.cartItem}>
                  <img src={asset(item.image)} alt="" className={styles.cartItemImg} />
                  <div className={styles.cartItemInfo}>
                    <div className={styles.cartItemName}>{item.name}</div>
                    <div className={styles.cartItemPrice}>{item.priceDisplay}</div>
                  </div>
                  <button className={styles.cartRemove} onClick={() => removeFromCart(item.cartId)}>Remove</button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className={styles.cartFooter}>
                <div className={styles.cartTotal}><span>Total:</span><span>{formatCartTotal()}</span></div>
                <button
                  className={styles.cartCheckout}
                  onClick={() => {
                    setShowCart(false)
                    setShowCheckout(true)
                    setCheckoutError('')
                    setPlacedOrder(null)
                  }}
                >
                  Checkout
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {showCheckout && (
        <div className={styles.checkoutOverlay} onClick={() => !checkoutBusy && setShowCheckout(false)}>
          <section
            className={styles.checkoutPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.cartHeader}>
              <h2 className={styles.cartTitle} id="checkout-title">{placedOrder ? 'Order placed' : 'Schedule your order'}</h2>
              <button
                className={styles.cartClose}
                onClick={() => setShowCheckout(false)}
                aria-label="Close checkout"
                disabled={checkoutBusy}
              >
                ×
              </button>
            </div>
            {placedOrder ? (
              <div className={styles.checkoutSuccess}>
                <p className={styles.checkoutSuccessIcon} aria-hidden="true">✓</p>
                <h3>Thank you for your order!</h3>
                <p>Order <strong>{placedOrder.orderNumber}</strong> has been received.</p>
                <p>
                  {placedOrder.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} scheduled for{' '}
                  {new Intl.DateTimeFormat('en-PH', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: manilaTimeZone
                  }).format(new Date(placedOrder.scheduledAt))}.
                </p>
                {placedOrder.paymentMethod === 'gcash' && serviceConfig?.paymentMethods.find((method) => method.id === 'gcash') && (
                  <p>
                    Open GCash and send {formatPHP(placedOrder.totalCents)} to{' '}
                    {serviceConfig.paymentMethods.find((method) => method.id === 'gcash').accountName}
                    {' '}at {serviceConfig.paymentMethods.find((method) => method.id === 'gcash').accountNumber}.
                    Your order will remain unpaid until staff confirms the transfer.
                  </p>
                )}
                <p className={styles.checkoutSuccessTotal}>Total: {formatPHP(placedOrder.totalCents)}</p>
                <button
                  className={styles.cartCheckout}
                  onClick={() => { setShowCheckout(false); setActivePage('My Orders') }}
                >
                  View my orders
                </button>
              </div>
            ) : (
              <form className={styles.checkoutForm} onSubmit={handlePlaceOrder}>
                <div className={styles.checkoutLines}>
                  {cart.map((item) => (
                    <div className={styles.checkoutLine} key={item.cartId}>
                      <span>{item.name}</span><strong>{item.priceDisplay}</strong>
                    </div>
                  ))}
                  <div className={styles.checkoutLine}>
                    <span>Subtotal</span><strong>{formatPHP(cartTotalCents)}</strong>
                  </div>
                  {fulfillment === 'delivery' && deliveryQuote && (
                    <>
                      <div className={styles.checkoutLine}>
                        <span>Road distance</span><strong>{(deliveryQuote.distanceMeters / 1000).toFixed(1)} km</strong>
                      </div>
                      <div className={styles.checkoutLine}>
                        <span>Delivery fee</span><strong>{formatPHP(deliveryQuote.feeCents)}</strong>
                      </div>
                    </>
                  )}
                  <div className={`${styles.checkoutLine} ${styles.checkoutGrandTotal}`}>
                    <span>Total</span>
                    <strong>{formatPHP(cartTotalCents + (fulfillment === 'delivery' ? deliveryQuote?.feeCents || 0 : 0))}</strong>
                  </div>
                </div>

                <label className={styles.checkoutLabel}>
                  Pickup or delivery
                  <select
                    className={styles.checkoutInput}
                    value={fulfillment}
                    onChange={(event) => {
                      setFulfillment(event.target.value)
                      setDeliveryQuote(null)
                    }}
                    required
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery" disabled={!serviceConfig?.delivery.enabled}>
                      {serviceConfig?.delivery.enabled ? 'Delivery' : 'Delivery (not configured yet)'}
                    </option>
                  </select>
                </label>
                {fulfillment === 'delivery' && (
                  <>
                    <label className={styles.checkoutLabel}>
                      Delivery address
                      <textarea
                        className={`${styles.checkoutInput} ${styles.checkoutAddress}`}
                        value={deliveryAddress}
                        onChange={(event) => {
                          setDeliveryAddress(event.target.value)
                          setDeliveryQuote(null)
                        }}
                        minLength={8}
                        maxLength={500}
                        autoComplete="street-address"
                        required
                      />
                    </label>
                    <button
                      className={styles.quoteButton}
                      type="button"
                      onClick={requestDeliveryQuote}
                      disabled={quoteBusy || deliveryAddress.trim().length < 8 || !serviceConfig?.delivery.enabled}
                    >
                      {quoteBusy ? 'Calculating road distance…' : 'Calculate delivery fee'}
                    </button>
                    {serviceConfig?.delivery.enabled && (
                      <p className={styles.checkoutHint}>
                        ₱{(serviceConfig.delivery.baseFeeCents / 100).toFixed(2)} covers the first{' '}
                        {serviceConfig.delivery.includedKm} km, then ₱
                        {(serviceConfig.delivery.perKmCents / 100).toFixed(2)} per additional km.
                      </p>
                    )}
                  </>
                )}
                <div className={styles.checkoutSchedule}>
                  <label className={styles.checkoutLabel}>
                    Date (Asia/Manila)
                    <input
                      className={styles.checkoutInput}
                      type="date"
                      value={scheduleDate}
                      min={getManilaDate()}
                      max={maxScheduleDate}
                      onChange={(event) => updateScheduleDate(event.target.value)}
                      required
                    />
                  </label>
                  <label className={styles.checkoutLabel}>
                    Time
                    <select
                      className={styles.checkoutInput}
                      value={scheduleTime}
                      onChange={(event) => setScheduleTime(event.target.value)}
                      required
                    >
                      {availableScheduleTimes.length === 0 && <option value="">No slots left today</option>}
                      {availableScheduleTimes.map((slot) => <option value={slot.value} key={slot.value}>{slot.label}</option>)}
                    </select>
                  </label>
                </div>
                <p className={styles.checkoutHint}>Pickup and delivery are scheduled every 30 minutes, 9:00 AM–8:30 PM.</p>
                <label className={styles.checkoutLabel}>
                  Contact phone
                  <input
                    className={styles.checkoutInput}
                    type="tel"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    minLength={7}
                    maxLength={25}
                    autoComplete="tel"
                    required
                  />
                </label>
                <label className={styles.checkoutLabel}>
                  Payment method
                  <select
                    className={styles.checkoutInput}
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    required
                  >
                    {serviceConfig?.paymentMethods.map((method) => (
                      <option value={method.id} key={method.id}>{method.label}</option>
                    ))}
                  </select>
                </label>
                {serviceConfig?.onlinePaymentMessage && (
                  <p className={styles.checkoutHint}>{serviceConfig.onlinePaymentMessage}</p>
                )}
                {paymentMethod === 'gcash' && serviceConfig?.paymentMethods.find((method) => method.id === 'gcash') && (
                  <p className={styles.checkoutHint}>
                    Pay online with GCash for pickup or delivery. After placing your order, send the total to{' '}
                    {serviceConfig.paymentMethods.find((method) => method.id === 'gcash').accountName}
                    {' '}({serviceConfig.paymentMethods.find((method) => method.id === 'gcash').accountNumber}).
                    Staff will confirm your transfer.
                  </p>
                )}
                {serviceConfigError && <p className={styles.checkoutError} role="alert">{serviceConfigError}</p>}
                {checkoutError && <p className={styles.checkoutError} role="alert">{checkoutError}</p>}
                <button
                  className={styles.cartCheckout}
                  type="submit"
                  disabled={
                    checkoutBusy ||
                    !serviceConfig ||
                    !paymentMethod ||
                    !scheduleTime ||
                    (fulfillment === 'delivery' && !deliveryQuote)
                  }
                >
                  {checkoutBusy ? 'Placing order…' : `Place order · ${formatPHP(cartTotalCents + (fulfillment === 'delivery' ? deliveryQuote?.feeCents || 0 : 0))}`}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default HeroSection
