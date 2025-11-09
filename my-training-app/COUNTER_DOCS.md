# Counter API Test - Documentation

## 📋 Overview

This project implements a counter system with simulated endpoint to test the integration between frontend and backend using React + Vite + Tailwind CSS + Radix UI.

## 🚀 Technologies Utilised

- **React 19** - Main framework
- **TypeScript** - Static typing
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility CSS framework
- **Radix UI Icons** - Accessible icons
- **clsx** - Library for CSS class manipulation

## 🏗️ Project Structure

```
src/
├── components/
│   └── Counter.tsx          # Main counter component
├── services/
│   └── counterApi.ts        # Counter API simulation
├── App.tsx                  # Main application component
├── main.tsx                 # Entry point
└── index.css                # Global styles with Tailwind
```

## 🔧 Implemented Functionalities

### Counter API (`src/services/counterApi.ts`)
- **GET Counter**: Fetches the current counter value
- **POST Increment**: Increments the counter by +1
- **POST Decrement**: Decrements the counter by -1
- **POST Reset**: Resets the counter to 0
- **Network latency simulation** (300-800ms)
- **Error handling** and standardised responses

### Counter Component (`src/components/Counter.tsx`)
- **Responsive interface** with Tailwind CSS
- **Loading states** with spinners
- **Visual feedback** for success and error
- **Modern design** with gradients and shadows
- **Accessibility** with Radix UI icons
- **Smooth animations** for hover and click

## 🎨 Design Features

- **Dark mode ready** - Complete support for dark theme
- **Responsive design** - Works on all devices
- **Microinteractions** - Hover, active and loading animations
- **Status indicators** - Visual API connection indicators
- **Temporal feedback** - Messages disappear after 3 seconds

## 🔄 Operation Flow

1. **Initialisation**: Component loads the initial counter value
2. **Interaction**: User clicks on action buttons
3. **API Call**: Request is sent to the simulated API
4. **Loading**: Interface shows loading state
5. **Response**: Result is processed and displayed
6. **Feedback**: User receives visual confirmation of the action

## 🧪 How to Test

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Access**: http://localhost:5175/

3. **Test functionalities**:
   - ✅ Increment counter
   - ✅ Decrement counter
   - ✅ Reset counter
   - ✅ Reload counter
   - ✅ Loading states
   - ✅ Feedback messages

## 📱 Interface

The Counter component includes:

- **Central display** with the current value highlighted
- **4 action buttons** with intuitive icons
- **API status** with visual indicator
- **Timestamp** of last update
- **Feedback messages** coloured by context

## 🎯 Implementation Benefits

- **Modular**: Clear separation between UI and API logic
- **Typed**: TypeScript guarantees type safety
- **Reusable**: Component can be easily integrated
- **Testable**: Simulated API facilitates development and testing
- **Scalable**: Structure prepared for real API

## 🔧 Next Steps

To integrate with real API:

1. Replace `counterApi.ts` with real HTTP calls
2. Configure API base URL in environment
3. Add authentication if necessary
4. Implement retry logic and error boundaries
5. Add unit and integration tests

## 🎨 Customisation

The component accepts props for customisation:
- `className`: Additional CSS classes
- Easily extensible for other props

Styles can be modified via Tailwind classes in the component.