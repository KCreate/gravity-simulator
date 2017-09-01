const PI = Math.PI
const TAU = 2 * Math.PI
const G = 10
const fourThirds = 4 / 3
const canvas_side_w = 1900
const canvas_side_h = 1000
const body_min_radius = 5
const orbit_trace_decay = 1
const com_radius = 3
let control_speed_delta = 0.001
const velocity_vector_scale = 20

let predict_orbit = true
const orbit_alpha = 0.3
let orbit_prediction_steps = 128
let orbit_prediction_plot_step = 1
const orbit_minimum_periapsis = 10

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
    this.color = color
    this.predict_orbit = predict_orbit
    this.radius = radius
    this.acceleration = 0
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
    this.camerax = 0
    this.cameray = 0

    this.saved_state = undefined
  }

  save_state() {
    this.saved_state = {
      bodies: this.bodies.map((body) => Object.assign({}, body)),
      camerax: this.camerax,
      cameray: this.cameray
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

    this.camerax = this.saved_state.camerax
    this.cameray = this.saved_state.cameray
  }

  focus_body(body) {
    this.camerax = body.posx - canvas_side_w / 2
    this.cameray = body.posy - canvas_side_h / 2
  }

  add_body(body) {
    this.bodies.push(body);
  }

  step() {

    // Apply gravitational forces
    this.bodies.map((source) => {
      if (source.mass == 0) return

      source.acceleration = 0

      let sax = 0
      let say = 0

      this.bodies.map((other) => {
        if (source === other) return
        if (other.mass == 0) return

        // Calculate the distance between the two bodies
        const delx = other.posx - source.posx
        const dely = other.posy - source.posy
        const distance = Math.max(orbit_minimum_periapsis, Math.sqrt(delx * delx + dely * dely))

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

        sax += ax
        say += ay

        source.velx += ax
        source.vely += ay
      })

      source.acceleration = Math.sqrt(sax * sax + say * say)
    })

    // Move the bodies
    this.bodies.map((body) => {
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
        x: body.posx - this.camerax,
        y: body.posy - this.cameray
      }))

      for (let i = 0; i < orbit_prediction_steps; i++) {

        // only draw a line every couple points
        if (i % orbit_prediction_plot_step == 0) {
          this.bodies.map((body, index) => {
            if (!body.predict_orbit) return

            // Calculate coordinates of orbit plot points
            const start_pos_x = last_body_coordinates[index].x
            const start_pos_y = last_body_coordinates[index].y
            const end_pos_x = body.posx - this.camerax
            const end_pos_y = body.posy - this.cameray

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
        this.focus_body(this.bodies[0])
      }
      this.rewind()
    }

    // Render the bodies
    this.bodies.map((body) => {

      // calculate radius of body based on its mass
      const canvas_pos_x = body.posx - this.camerax
      const canvas_pos_y = body.posy - this.cameray

      this.context.beginPath()
      this.context.arc(canvas_pos_x, canvas_pos_y, body.radius, 0, TAU)

      // set body color
      this.context.fillStyle = body.color

      // draw the body
      this.context.closePath()
      this.context.fill()

      // draw velocity vector
      const velocity_vector_x = canvas_pos_x + (body.velx * velocity_vector_scale)
      const velocity_vector_y = canvas_pos_y + (body.vely * velocity_vector_scale)
      this.context.beginPath()
      this.context.moveTo(canvas_pos_x, canvas_pos_y)
      this.context.lineTo(velocity_vector_x, velocity_vector_y)
      this.context.strokeStyle = "green"
      this.context.stroke()
      this.context.closePath()
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
    this.context.arc(comx - this.camerax, comy - this.cameray, com_radius, 0, TAU)
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
      "w, a, s, d | Apply thrust to spacecraft",
      "o, p       | Increase or decrease thrust",
      "q          | Stop simulation",
      "g          | Toggle orbit prediction",
      "h, j       | Increase or decrease orbit prediction steps",
      "k, l       | Increase or decrease orbit step interval",
      "r          | Reload page",
      "",
      "Bodies:"
    ]

    this.bodies.map((body, index) => {
      const velocity = Math.round( Math.sqrt(body.velx * body.velx + body.vely * body.vely) * 100) / 100
      const acceleration = Math.round(body.acceleration * 100) / 100

      status_lines.push(
        "#" + index + " | V: " + velocity + " G: " + acceleration
      )
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
const star =      new Body(10000,   0,    0,  0,  0,    "yellow",   false,  50)
const planet =    new Body(500,     500,  0,  0,  14,   "blue",     true,   7)
const spaceship = new Body(1,       550,  0,  0,  22,    "gold",     true,   3)

main_simulation.add_body(star)
main_simulation.add_body(planet)
main_simulation.add_body(spaceship)

const fps = 64
const game_interval = setInterval(() => {
  main_simulation.step()
  main_simulation.focus_body(star)
  main_simulation.render()
}, 1000 / fps)

window.onkeydown = (event) => {
  event.preventDefault()

  switch (event.key) {
    case "w": {
      spaceship.vely -= control_speed_delta
      break
    }

    case "a": {
      spaceship.velx -= control_speed_delta
      break
    }

    case "s": {
      spaceship.vely += control_speed_delta
      break
    }

    case "d": {
      spaceship.velx += control_speed_delta
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
      orbit_prediction_steps -= 8
      break
    }

    case "j": {
      orbit_prediction_steps += 8
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

    case "r": {
      window.location = window.location
      break
    }
  }
}
























