const PI = Math.PI
const TAU = 2 * Math.PI
const G = 10
const fourThirds = 4 / 3
const canvas_side_w = 1900
const canvas_side_h = 1000
const body_min_radius = 5
const orbit_trace_decay = 1
const com_radius = 3
let control_speed_delta = 0.1
const velocity_vector_scale = 20

let predict_orbit = true
const orbit_alpha = 0.7
let orbit_prediction_steps = 1024
let orbit_prediction_plot_step = 1
const orbit_minimum_periapsis = 10

let selected_spaceship = 0

/*
 * Represents a single object with mass and absolute velocity
 * */
class Body {
  constructor(mass, posx, posy, velx, vely, color, predict_orbit, radius) {
    this.mass = mass
    this.posx = posx
    this.posy = posy
    this.velx = velx
    this.vely = vely
    this.accx = 0
    this.accy = 0
    this.color = color
    this.predict_orbit = predict_orbit
    this.radius = radius
  }
  
  speed() {
    return Math.sqrt(this.velx * this.velx + this.vely * this.vely)
  }
}

/*
 * Represents a single simulation context
 * */
class Simulation {
  constructor(canvas) {
    this.bodies = []
    this.canvas = canvas
    this.context = canvas.getContext("2d")
    this.focused_body = 0

    this.saved_state = undefined
  }
  
  camerax() { return this.bodies[this.focused_body].posx - canvas_side_w / 2 }
  cameray() { return this.bodies[this.focused_body].posy - canvas_side_h / 2 }

  save_state() {
    this.saved_state = {
      bodies: this.bodies.map((body) => Object.assign({}, body))
    }
  }

  rewind() {
    if (!this.saved_state) return;

    this.saved_state.bodies.map((save, index) => {
      this.bodies[index].posx = save.posx
      this.bodies[index].posy = save.posy
      this.bodies[index].velx = save.velx
      this.bodies[index].vely = save.vely
    })
  }

  add_body(body) {
    this.bodies.push(body);
  }

  step() {

    // Apply gravitational and collision forces
    this.bodies.map((source) => {
      if (source.mass == 0) return

      this.bodies.map((other) => {
        if (source === other) return
        if (other.mass == 0) return

        // Calculate the distance between the two bodies
        const delx = other.posx - source.posx
        const dely = other.posy - source.posy
        const distance = Math.sqrt(delx * delx + dely * dely)

        // Calculate the gravitational attraction based on the distance
        // between the two bodies
        //
        // Formula: Fg = G * ((m1 * m2) / d^2)
        //
        // NOTE: m2 is set to 1 to only calculate the force exerted
        // onto the source object by the other object
        const force = G * ((source.mass * other.mass) / (distance * distance))

        // Divide the force into it's x and y components
        const fx = (force / distance) * delx
        const fy = (force / distance) * dely

        // Apply the force to the source object
        const ax = fx / source.mass
        const ay = fy / source.mass

        source.velx += ax
        source.vely += ay
      })
    })
    
    // Collision handling
    this.bodies.map((source) => {
      if (source.mass == 0) return

      this.bodies.map((other) => {
        if (source === other) return
        if (other.mass == 0) return

        // Calculate the distance between the two bodies
        const delx = other.posx - source.posx
        const dely = other.posy - source.posy
        const distance = Math.sqrt(delx * delx + dely * dely)

        // Calculate the distance between the bodies in the next step
        // assuming there are no gravitational changes during the step
        // This is of course wrong but its good enough
        const delx_next = (other.posx + other.velx) - (source.posx + source.velx)
        const dely_next = (other.posy + other.vely) - (source.posy + source.vely)
        const distance_next = Math.sqrt(delx_next * delx_next + dely_next * dely_next)
        
        if (source.radius + other.radius >= distance_next) {
          const other_acceleration = Math.sqrt(other.mass * other.speed() * other.speed())
          const accx = (other_acceleration / distance) * delx
          const accy = (other_acceleration / distance) * dely
          
          source.accx -= accx / source.mass
          source.accy -= accy / source.mass
        }
      })
    })

    // Move the bodies
    this.bodies.map((body) => {
      body.velx += body.accx
      body.vely += body.accy
      body.accx = body.accy = 0
      body.posx += body.velx
      body.posy += body.vely
    })
  }

  render() {

    this.context.fillStyle = "black"
    this.context.globalAlpha = orbit_trace_decay
    this.context.fillRect(0, 0, canvas_side_w, canvas_side_h)
    this.context.globalAlpha = 1

    // draw the predicted orbits
    if (predict_orbit) {
      this.save_state()

      let last_body_coordinates = this.bodies.map((body) => ({
        x: body.posx - this.camerax(),
        y: body.posy - this.cameray()
      }))

      for (let i = 0; i < orbit_prediction_steps; i++) {

        // only draw a line every couple points
        if (i % orbit_prediction_plot_step == 0) {
          this.bodies.map((body, index) => {
            if (!body.predict_orbit) return

            // Calculate coordinates of orbit plot points
            const start_pos_x = last_body_coordinates[index].x
            const start_pos_y = last_body_coordinates[index].y
            const end_pos_x = body.posx - this.camerax()
            const end_pos_y = body.posy - this.cameray()

            this.context.beginPath()
            this.context.globalAlpha = orbit_alpha
            this.context.moveTo(start_pos_x, start_pos_y)
            this.context.lineTo(end_pos_x, end_pos_y)
            this.context.strokeStyle = body.color
            this.context.stroke()
            this.context.closePath()
            this.context.globalAlpha = 1

            last_body_coordinates[index].x = end_pos_x
            last_body_coordinates[index].y = end_pos_y
          })
        }

        this.step()
      }
      this.rewind()
    }

    // Render the bodies
    this.bodies.map((body, index) => {
      const canvas_pos_x = body.posx - this.camerax()
      const canvas_pos_y = body.posy - this.cameray()

      this.context.beginPath()
      this.context.arc(canvas_pos_x, canvas_pos_y, body.radius, 0, TAU)

      // set body color
      this.context.fillStyle = body.color

      // draw the body
      this.context.closePath()
      this.context.fill()

      // draw velocity vector
      if (selected_spaceship == index) {
        const velocity_vector_x = canvas_pos_x + ((body.velx - this.bodies[this.focused_body].velx) * velocity_vector_scale)
        const velocity_vector_y = canvas_pos_y + ((body.vely - this.bodies[this.focused_body].vely) * velocity_vector_scale)
        this.context.beginPath()
        this.context.moveTo(canvas_pos_x, canvas_pos_y)
        this.context.lineTo(velocity_vector_x, velocity_vector_y)
        this.context.strokeStyle = "green"
        this.context.stroke()
        this.context.closePath()
      }
    })

    // Calculate the center of mass
    let tmpx = 0, tmpy = 0, mt = 0
    this.bodies.map((body) => {
      tmpx += body.mass * body.posx
      tmpy += body.mass * body.posy
      mt += body.mass
    })

    // Draw the center of mass on the canvas
    const comx = tmpx / mt
    const comy = tmpy / mt

    this.context.beginPath()
    this.context.arc(comx - this.camerax(), comy - this.cameray(), com_radius, 0, TAU)
    this.context.fillStyle = "green"
    this.context.closePath()
    this.context.fill()

    const status_lines = [
      "Gravity Simulator, Copyright © 2017 Leonard Schütz",
      "",
      "Info:",
      "Throttle: " + control_speed_delta,
      "Orbit Prediction: " + predict_orbit,
      "Orbit Prediction Step Count: " + orbit_prediction_steps,
      "Orbit Prediction Interval: " + orbit_prediction_plot_step,
      "",
      "Controls:",
      "w, a, s, d   | Apply thrust to spacecraft",
      "o, p         | Increase or decrease thrust",
      "q            | Stop simulation",
      "g            | Toggle orbit prediction",
      "h, j         | Increase or decrease orbit prediction steps",
      "k, l         | Increase or decrease orbit step interval",
      "Tab          | Change active body",
      "Shift + Tab  | Change focused body",
      "r            | Reload page",
      "",
      "Bodies:"
    ]

    this.bodies.map((body, index) => {
      const velocity = Math.round( Math.sqrt(body.velx * body.velx + body.vely * body.vely) * 100) / 100

      let line = "#" + index

      if (index == this.focused_body) {
        line += " Focused "
      } else {
        line += "         "
      }
      
      if (index == selected_spaceship) {
        line += " Active "
      } else {
        line += "        "
      }

      line += "| V: " + velocity.toFixed(3)

      status_lines.push(line)
    })

    // Draw status information
    this.context.font = "14px monospace"
    this.context.fillStyle = "white"
    status_lines.map((line, index) => {
      this.context.fillText(line, 10, index * 16 + 20)
    })
  }

  clear_canvas() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

// Create and config canvas
const main_canvas = document.getElementById("main_canvas")
main_canvas.width = canvas_side_w
main_canvas.height = canvas_side_h

// This is the main simulation
const main_simulation = new Simulation(main_canvas)

// Specific bodies
const reference =     new Body(0, 0, 0, 0, 0, "white", false, 1)

const star = new Body(800, 0, 0, 0, 0, "yellow", true, 40)
const planet = new Body(200, 500, 0, 0, 4.4, "blue", true, 10)
const spacecraft = new Body(0.001, 560, 0, 0, 10.2, "gold", true, 2)

main_simulation.add_body(reference)
main_simulation.add_body(star)
main_simulation.add_body(planet)
main_simulation.add_body(spacecraft)

main_simulation.focused_body = 2
selected_spaceship = 3

const fps = 16
const game_interval = setInterval(() => {
  main_simulation.step()
  main_simulation.render()
}, 1000 / fps)

window.onkeydown = (event) => {
  switch (event.key) {
    case "w": {
      main_simulation.bodies[selected_spaceship].vely -= control_speed_delta
      break
    }

    case "a": {
      main_simulation.bodies[selected_spaceship].velx -= control_speed_delta
      break
    }

    case "s": {
      main_simulation.bodies[selected_spaceship].vely += control_speed_delta
      break
    }

    case "d": {
      main_simulation.bodies[selected_spaceship].velx += control_speed_delta
      break
    }

    case "q": {
      clearInterval(game_interval)
      break
    }

    case "o": {
      control_speed_delta *= 0.9
      break
    }

    case "p": {
      control_speed_delta *= 1.1
      break
    }

    case "g": {
      predict_orbit = !predict_orbit
      break
    }

    case "h": {
      orbit_prediction_steps *= 0.9
      break
    }

    case "j": {
      orbit_prediction_steps *= 1.1
      break
    }

    case "k": {
      orbit_prediction_plot_step -= 1
      break
    }

    case "l": {
      orbit_prediction_plot_step += 1
      break
    }

    case "Tab": {
      if (event.shiftKey) {
        main_simulation.focused_body = (main_simulation.focused_body + 1) % main_simulation.bodies.length
      } else {
        selected_spaceship = (selected_spaceship + 1) % main_simulation.bodies.length
      }
		
      break
    }

    case "r": {
      window.location = window.location
      break
    }
    
    default: { return }
  }
  
  event.preventDefault()
}
























